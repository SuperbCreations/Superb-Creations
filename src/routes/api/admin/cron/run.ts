import { createFileRoute } from "@tanstack/react-router";
import { requireCronSecret } from "@/lib/env.server";
import { runProductionTask, type ProductionTask } from "@/lib/production-ops.functions";

const allowedTasks = new Set<ProductionTask>([
  "all",
  "expire_due_manual_payment_orders",
  "process_email_queue",
  "generate_daily_analytics_snapshot",
  "sync_shipment_statuses",
  "cleanup_old_events",
  "check_system_health",
]);

export const Route = createFileRoute("/api/admin/cron/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          requireCronSecret(request);
          const body = await request.json().catch(() => ({}));
          const task = String(body.task || new URL(request.url).searchParams.get("task") || "all") as ProductionTask;
          if (!allowedTasks.has(task)) {
            return Response.json({ ok: false, error: "Unknown task" }, { status: 400 });
          }
          const result = await runProductionTask(task);
          return Response.json(result);
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "Cron task failed" },
            { status: error instanceof Error && error.message.includes("secret") ? 401 : 500 },
          );
        }
      },
      GET: async () => new Response("Production cron endpoint. POST only.", { status: 200 }),
    },
  },
});
