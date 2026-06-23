import { createFileRoute } from "@tanstack/react-router";
import { optionalWebhookTokenValid } from "@/lib/env.server";

function eventType(payload: any) {
  return String(payload.event || payload.type || payload.event_type || "").toLowerCase();
}

export const Route = createFileRoute("/api/public/webhooks/brevo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!optionalWebhookTokenValid(request, "BREVO_WEBHOOK_TOKEN")) {
          return Response.json({ ok: false, error: "Invalid webhook token" }, { status: 401 });
        }
        const payload = await request.json().catch(() => null);
        if (!payload) return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
        const events = Array.isArray(payload) ? payload : [payload];
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let processed = 0;

        for (const item of events) {
          const type = eventType(item);
          const messageId = item["message-id"] || item.messageId || item.message_id || item.uuid || null;
          const email = String(item.email || item.recipient || "").toLowerCase() || null;
          const { data: log } = messageId
            ? await (supabaseAdmin as any)
                .from("email_logs")
                .select("id")
                .eq("provider_message_id", messageId)
                .maybeSingle()
            : { data: null };
          const emailLogId = log?.id ?? null;
          await (supabaseAdmin as any).from("email_events").insert({
            email_log_id: emailLogId,
            provider: "brevo",
            event_type: type || "unknown",
            payload: item,
          });
          if (emailLogId) {
            const update: Record<string, unknown> = {};
            if (["delivered", "sent"].includes(type)) update.delivered_at = new Date().toISOString();
            if (type === "opened" || type === "open") update.opened_at = new Date().toISOString();
            if (type === "click" || type === "clicked") update.clicked_at = new Date().toISOString();
            if (["hard_bounce", "soft_bounce", "bounce", "blocked", "spam"].includes(type)) update.status = type === "spam" ? "complaint" : "bounced";
            if (Object.keys(update).length > 0) {
              await (supabaseAdmin as any).from("email_logs").update(update).eq("id", emailLogId);
            }
          } else if (email) {
            await (supabaseAdmin as any).from("email_events").insert({
              provider: "brevo",
              event_type: "unmatched_recipient",
              payload: { email, original_event: item },
            });
          }
          processed += 1;
        }

        return Response.json({ ok: true, processed });
      },
      GET: async () => new Response("Brevo webhook endpoint. POST only.", { status: 200 }),
    },
  },
});
