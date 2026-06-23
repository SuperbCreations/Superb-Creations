type Severity = "debug" | "info" | "warning" | "error" | "critical";

function cleanMetadata(metadata: Record<string, unknown> = {}) {
  const blocked = ["secret", "token", "key", "password", "authorization", "cookie"];
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key, value]) => !blocked.some((word) => key.toLowerCase().includes(word)) && typeof value !== "function")
      .slice(0, 50),
  );
}

export async function logServerError(args: {
  source: string;
  severity?: Severity;
  message: string;
  stack?: string | null;
  userId?: string | null;
  requestPath?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("system_error_logs").insert({
      source: args.source,
      severity: args.severity || "error",
      message: args.message.slice(0, 2000),
      stack: args.stack?.slice(0, 6000) || null,
      user_id: args.userId || null,
      request_path: args.requestPath || null,
      metadata: cleanMetadata(args.metadata),
    });
  } catch (error) {
    console.warn("[observability] server error log failed", error);
  }
}

export async function logAdminAudit(args: {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("admin_audit_logs").insert({
      actor_id: args.actorId || null,
      actor_email: args.actorEmail || null,
      action: args.action,
      entity_type: args.entityType,
      entity_id: args.entityId || null,
      summary: args.summary || null,
      metadata: cleanMetadata(args.metadata),
    });
  } catch (error) {
    console.warn("[observability] admin audit log failed", error);
  }
}
