import { supabase } from "@/integrations/supabase/client";

type Severity = "debug" | "info" | "warning" | "error" | "critical";

function cleanMetadata(metadata: Record<string, unknown> = {}) {
  const blocked = ["secret", "token", "key", "password", "authorization", "cookie"];
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key, value]) => !blocked.some((word) => key.toLowerCase().includes(word)) && typeof value !== "function")
      .slice(0, 30),
  );
}

export async function logClientError(args: {
  source: string;
  severity?: Severity;
  message: string;
  stack?: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (typeof window === "undefined") return;
  try {
    await (supabase as any).rpc("record_system_error", {
      p_source: args.source,
      p_severity: args.severity || "error",
      p_message: args.message.slice(0, 2000),
      p_stack: args.stack?.slice(0, 6000) || null,
      p_user_id: args.userId || null,
      p_request_path: window.location.pathname,
      p_metadata: cleanMetadata(args.metadata),
    });
  } catch (error) {
    if (import.meta.env.DEV) console.warn("[observability] client error log failed", error);
  }
}

export async function markSystemErrorResolved(id: string) {
  const { error } = await (supabase as any)
    .from("system_error_logs")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export function metadataPreview(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}
