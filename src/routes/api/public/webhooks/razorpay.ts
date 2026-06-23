import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Razorpay webhook receiver.
 *
 * Configure in Razorpay Dashboard → Settings → Webhooks:
 *   URL:    https://<your-domain>/api/public/webhooks/razorpay
 *   Events: payment.captured, payment.failed, order.paid
 *   Secret: store the same value in env var RAZORPAY_WEBHOOK_SECRET
 *
 * Idempotency: every event id (`x-razorpay-event-id`) is stored in
 * `razorpay_webhook_events`. Duplicates short-circuit before touching
 * the order, so paid status and inventory can never double-apply.
 */

const ALLOWED_EVENTS = new Set([
  "payment.captured",
  "order.paid",
  "payment.failed",
]);

function bad(status: number, message: string) {
  console.error("[razorpay-webhook]", status, message);
  return new Response(message, { status });
}

export const Route = createFileRoute("/api/public/webhooks/razorpay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) return bad(500, "Webhook secret not configured");

        const signature = request.headers.get("x-razorpay-signature") ?? "";
        const eventId =
          request.headers.get("x-razorpay-event-id") ??
          request.headers.get("x-razorpay-request-id") ??
          "";

        const rawBody = await request.text();
        if (!rawBody) return bad(400, "Empty body");

        // Verify HMAC SHA256 signature over raw body
        const expected = createHmac("sha256", secret)
          .update(rawBody)
          .digest("hex");
        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expected);
        const valid =
          sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
        if (!valid) return bad(401, "Invalid signature");

        let payload: any;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return bad(400, "Invalid JSON");
        }

        const eventType: string = payload?.event ?? "";
        if (!ALLOWED_EVENTS.has(eventType)) {
          // Accept and ignore — Razorpay retries on non-2xx
          console.log("[razorpay-webhook] ignoring event", eventType);
          return new Response("ignored", { status: 200 });
        }

        const paymentEntity = payload?.payload?.payment?.entity ?? null;
        const orderEntity = payload?.payload?.order?.entity ?? null;
        const razorpayOrderId: string | null =
          paymentEntity?.order_id ?? orderEntity?.id ?? null;
        const razorpayPaymentId: string | null = paymentEntity?.id ?? null;
        const internalOrderId: string | null =
          paymentEntity?.notes?.order_id ??
          orderEntity?.notes?.order_id ??
          orderEntity?.receipt ??
          null;

        const effectiveEventId =
          eventId ||
          `${eventType}:${razorpayPaymentId ?? razorpayOrderId ?? Date.now()}`;

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        // Idempotency guard: try to insert the event row first.
        const { error: insertErr } = await supabaseAdmin
          .from("razorpay_webhook_events")
          .insert({
            event_id: effectiveEventId,
            event_type: eventType,
            razorpay_order_id: razorpayOrderId,
            razorpay_payment_id: razorpayPaymentId,
            order_id: internalOrderId,
            payload,
          });

        if (insertErr) {
          // Unique violation = already processed → ack success
          if ((insertErr as any).code === "23505") {
            console.log(
              "[razorpay-webhook] duplicate event ignored",
              effectiveEventId,
            );
            return new Response("duplicate", { status: 200 });
          }
          console.error("[razorpay-webhook] insert failed", insertErr);
          return bad(500, "Failed to record event");
        }

        // Locate the order: prefer notes/receipt, fall back to razorpay_order_id
        let orderRow: { id: string; payment_status: string | null; total?: number | null; payment_fee?: number | null } | null =
          null;
        if (internalOrderId) {
          const { data } = await supabaseAdmin
            .from("orders")
            .select("id,payment_status,total,payment_fee")
            .eq("id", internalOrderId)
            .maybeSingle();
          orderRow = data ?? null;
        }
        if (!orderRow && razorpayOrderId) {
          const { data } = await supabaseAdmin
            .from("orders")
            .select("id,payment_status,total,payment_fee")
            .eq("razorpay_order_id", razorpayOrderId)
            .maybeSingle();
          orderRow = data ?? null;
        }

        if (!orderRow) {
          console.warn(
            "[razorpay-webhook] order not found for event",
            effectiveEventId,
            { razorpayOrderId, internalOrderId },
          );
          // Still 200 — we've recorded the event for audit; nothing to update
          return new Response("order-not-found", { status: 200 });
        }

        if (eventType === "payment.failed") {
          if (orderRow.payment_status === "paid") {
            console.log(
              "[razorpay-webhook] paid order received failed event, skipping",
              orderRow.id,
            );
            return new Response("already-paid", { status: 200 });
          }
          await supabaseAdmin
            .from("orders")
            .update({
              payment_status: "failed",
              status: "payment_failed",
              operational_status: "payment_failed",
              razorpay_payment_id: razorpayPaymentId ?? undefined,
              payment_failure_reason: paymentEntity?.error_description ?? paymentEntity?.error_reason ?? "Razorpay payment failed",
            })
            .eq("id", orderRow.id);
          await (supabaseAdmin as any).rpc("append_order_event", {
            p_order_id: orderRow.id,
            p_event_type: "payment_failed",
            p_label: "Payment Failed",
            p_details: {
              reason: paymentEntity?.error_description ?? paymentEntity?.error_reason ?? null,
              event_id: effectiveEventId,
            },
            p_visible_to_customer: true,
          });
          await (supabaseAdmin as any).rpc("log_payment_ledger", {
            p_order_id: orderRow.id,
            p_method: "razorpay",
            p_provider: "razorpay",
            p_amount: orderRow.total ?? 0,
            p_fee: orderRow.payment_fee ?? 0,
            p_status: "failed",
            p_reference_id: null,
            p_provider_order_id: razorpayOrderId,
            p_provider_payment_id: razorpayPaymentId,
            p_failure_reason: paymentEntity?.error_description ?? paymentEntity?.error_reason ?? "Razorpay payment failed",
            p_raw_metadata: { event_id: effectiveEventId },
          });
          console.log(
            "[razorpay-webhook] order marked failed",
            orderRow.id,
            effectiveEventId,
          );
          return new Response("ok", { status: 200 });
        }

        // payment.captured or order.paid — confirm payment
        // Skip if already paid (handles both webhook-after-client and dupes)
        if (orderRow.payment_status === "paid") {
          console.log(
            "[razorpay-webhook] order already paid, skipping",
            orderRow.id,
          );
          return new Response("already-paid", { status: 200 });
        }

        const { error: finalizeErr } = await (supabaseAdmin as any).rpc(
          "finalize_razorpay_payment",
          {
            p_order_id: orderRow.id,
            p_razorpay_order_id: razorpayOrderId,
            p_razorpay_payment_id: razorpayPaymentId,
          },
        );

        if (finalizeErr) {
          console.error("[razorpay-webhook] order finalization failed", finalizeErr);
          return bad(500, "Failed to update order");
        }

        console.log(
          "[razorpay-webhook] order marked paid",
          orderRow.id,
          eventType,
          effectiveEventId,
        );
        return new Response("ok", { status: 200 });
      },

      GET: async () =>
        new Response("Razorpay webhook endpoint — POST only", { status: 200 }),
    },
  },
});
