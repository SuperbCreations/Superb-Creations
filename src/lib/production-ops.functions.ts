import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { processEmailQueueBatch } from "@/lib/notifications.functions";

const runTaskSchema = z.object({
  accessToken: z.string().min(20),
  task: z.enum([
    "expire_due_manual_payment_orders",
    "process_email_queue",
    "generate_daily_analytics_snapshot",
    "sync_shipment_statuses",
    "cleanup_old_events",
    "check_system_health",
  ]),
});

export type ProductionTask = z.infer<typeof runTaskSchema>["task"] | "all";

export async function runProductionTask(task: ProductionTask) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { logServerError } = await import("@/lib/observability.server");
  const startedAt = new Date().toISOString();
  const { data: runLog } = await (supabaseAdmin as any)
    .from("cron_run_logs")
    .insert({ task, status: "started", started_at: startedAt })
    .select("id")
    .maybeSingle();

  try {
    const summary =
      task === "all"
        ? {
            expire_due_manual_payment_orders: await expireDueManualPaymentOrders(),
            process_email_queue: await processEmailQueueBatch(50),
            generate_daily_analytics_snapshot: await generateDailyAnalyticsSnapshot(),
            sync_shipment_statuses: await syncShipmentStatuses(),
            cleanup_old_events: await cleanupOldEvents(),
            check_system_health: await checkSystemHealth(),
          }
        : await runSingleTask(task);

    if (runLog?.id) {
      await (supabaseAdmin as any)
        .from("cron_run_logs")
        .update({ status: "success", summary, finished_at: new Date().toISOString() })
        .eq("id", runLog.id);
    }
    return { ok: true as const, task, summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Production task failed";
    if (runLog?.id) {
      await (supabaseAdmin as any)
        .from("cron_run_logs")
        .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
        .eq("id", runLog.id);
    }
    await logServerError({
      source: "cron",
      severity: "error",
      message,
      stack: error instanceof Error ? error.stack : null,
      metadata: { task },
    });
    throw error;
  }
}

async function runSingleTask(task: Exclude<ProductionTask, "all">) {
  if (task === "expire_due_manual_payment_orders") return expireDueManualPaymentOrders();
  if (task === "process_email_queue") return processEmailQueueBatch(50);
  if (task === "generate_daily_analytics_snapshot") return generateDailyAnalyticsSnapshot();
  if (task === "sync_shipment_statuses") return syncShipmentStatuses();
  if (task === "cleanup_old_events") return cleanupOldEvents();
  return checkSystemHealth();
}

async function expireDueManualPaymentOrders() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("id")
    .in("payment_method", ["upi", "bank_transfer"])
    .in("payment_status", ["awaiting_payment", "under_review"])
    .lte("payment_expires_at", new Date().toISOString())
    .limit(100);
  if (error) throw error;
  let expired = 0;
  for (const order of orders ?? []) {
    const { error: expireError } = await (supabaseAdmin as any).rpc("expire_manual_payment_order", {
      p_order_id: order.id,
    });
    if (!expireError) expired += 1;
  }
  return { scanned: orders?.length ?? 0, expired };
}

async function generateDailyAnalyticsSnapshot() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).rpc("generate_daily_analytics_snapshot", {
    p_snapshot_date: new Date().toISOString().slice(0, 10),
  });
  if (error) throw error;
  return data ?? {};
}

async function syncShipmentStatuses() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("shipping_status", ["picked_up", "in_transit", "shipped", "out_for_delivery"]);
  if (error) throw error;
  return { providerSyncConfigured: false, activeShipments: count ?? 0 };
}

async function cleanupOldEvents() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const analytics = await (supabaseAdmin as any).from("analytics_events").delete().lt("created_at", cutoff).select("id");
  const popups = await (supabaseAdmin as any).from("marketing_popup_events").delete().lt("created_at", cutoff).select("id");
  return {
    analyticsEventsDeleted: analytics.data?.length ?? 0,
    popupEventsDeleted: popups.data?.length ?? 0,
  };
}

async function checkSystemHealth() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [orders, errors, queue] = await Promise.all([
    supabaseAdmin.from("orders").select("id", { count: "exact", head: true }),
    (supabaseAdmin as any).from("system_error_logs").select("id", { count: "exact", head: true }).eq("resolved", false),
    (supabaseAdmin as any).from("email_queue").select("id", { count: "exact", head: true }).in("status", ["queued", "failed"]),
  ]);
  return {
    ok: !orders.error && !errors.error && !queue.error,
    ordersReachable: !orders.error,
    unresolvedErrors: errors.count ?? 0,
    queuedEmails: queue.count ?? 0,
  };
}

export const runProductionTaskAsAdmin = createServerFn({ method: "POST" })
  .inputValidator((data) => runTaskSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireOwnerAdmin } = await import("@/lib/admin.server");
    const admin = await requireOwnerAdmin(data.accessToken);
    const result = await runProductionTask(data.task);
    const { logAdminAudit } = await import("@/lib/observability.server");
    await logAdminAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "run_production_task",
      entityType: "cron",
      entityId: data.task,
      summary: `Ran production task ${data.task}`,
      metadata: result.summary as Record<string, unknown>,
    });
    return result;
  });
