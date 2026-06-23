import { createFileRoute } from "@tanstack/react-router";
import { optionalWebhookTokenValid } from "@/lib/env.server";

export const Route = createFileRoute("/api/public/webhooks/shipping")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!optionalWebhookTokenValid(request, "SHIPPING_WEBHOOK_TOKEN")) {
          return Response.json({ ok: false, error: "Invalid webhook token" }, { status: 401 });
        }
        const payload = await request.json().catch(() => null);
        if (!payload) return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

        const orderId = payload.order_id || payload.orderId || payload.metadata?.order_id || null;
        const status = String(payload.status || payload.shipment_status || payload.event || "shipment_update").toLowerCase();
        const trackingNumber = payload.tracking_number || payload.awb || payload.trackingNumber || null;
        const provider = payload.provider || payload.carrier || "shipping_webhook";
        if (!orderId) {
          return Response.json({ ok: true, ignored: true, reason: "No order id in payload" });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await (supabaseAdmin as any).from("shipment_events").insert({
          order_id: orderId,
          status,
          courier_name: provider,
          tracking_number: trackingNumber,
          notes: JSON.stringify(payload).slice(0, 2000),
          visible_to_customer: true,
        });
        await (supabaseAdmin as any)
          .from("orders")
          .update({
            shipping_status: status,
            operational_status: status,
            tracking_number: trackingNumber || undefined,
            shipping_provider: provider,
          })
          .eq("id", orderId);
        await (supabaseAdmin as any).rpc("append_order_event", {
          p_order_id: orderId,
          p_event_type: "shipping_webhook",
          p_label: `Shipping ${status.replace(/_/g, " ")}`,
          p_details: { provider, tracking_number: trackingNumber },
          p_visible_to_customer: true,
        });
        return Response.json({ ok: true });
      },
      GET: async () => new Response("Shipping webhook endpoint. POST only.", { status: 200 }),
    },
  },
});
