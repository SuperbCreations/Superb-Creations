import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";

const createSchema = z.object({
  orderId: z.string().uuid(),
});

const verifySchema = z.object({
  orderId: z.string().uuid(),
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

const failureSchema = z.object({
  orderId: z.string().uuid(),
  razorpay_order_id: z.string().optional(),
  razorpay_payment_id: z.string().optional(),
  reason: z.string().trim().max(1000).optional(),
});

export const createRazorpayOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => createSchema.parse(data))
  .handler(async ({ data }) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return { configured: false as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orderRow, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id,total,payment_method,payment_status,razorpay_order_id")
      .eq("id", data.orderId)
      .single();
    if (orderError) throw orderError;
    if (orderRow.payment_method !== "razorpay") {
      throw new Error("Order is not configured for Razorpay payment.");
    }
    if (orderRow.payment_status === "paid") {
      throw new Error("Order is already paid.");
    }

    const amount = orderRow.total * 100;
    if (orderRow.razorpay_order_id) {
      return {
        configured: true as const,
        razorpayOrderId: orderRow.razorpay_order_id,
        keyId,
        amount,
      };
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt: data.orderId,
        notes: { order_id: data.orderId },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Razorpay order failed: ${res.status} ${text}`);
    }

    const order = (await res.json()) as { id: string };

    await supabaseAdmin
      .from("orders")
      .update({ razorpay_order_id: order.id })
      .eq("id", data.orderId);

    return {
      configured: true as const,
      razorpayOrderId: order.id,
      keyId,
      amount,
    };
  });

export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .inputValidator((data) => verifySchema.parse(data))
  .handler(async ({ data }) => {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new Error("Razorpay not configured");

    const expected = createHmac("sha256", keySecret)
      .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
      .digest("hex");

    const a = Buffer.from(expected);
    const b = Buffer.from(data.razorpay_signature);
    const valid = a.length === b.length && timingSafeEqual(a, b);
    if (!valid) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.rpc("log_payment_ledger", {
        p_order_id: data.orderId,
        p_method: "razorpay",
        p_provider: "razorpay",
        p_amount: 0,
        p_fee: 0,
        p_status: "signature_failed",
        p_reference_id: null,
        p_provider_order_id: data.razorpay_order_id,
        p_provider_payment_id: data.razorpay_payment_id,
        p_failure_reason: "Invalid Razorpay signature",
        p_raw_metadata: {},
      });
      return { ok: false as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await (supabaseAdmin as any).rpc(
      "finalize_razorpay_payment",
      {
        p_order_id: data.orderId,
        p_razorpay_order_id: data.razorpay_order_id,
        p_razorpay_payment_id: data.razorpay_payment_id,
      },
    );
    if (error) throw error;

    return { ok: true as const, result };
  });

export const markRazorpayPaymentFailed = createServerFn({ method: "POST" })
  .inputValidator((data) => failureSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id,total,payment_fee,payment_status")
      .eq("id", data.orderId)
      .eq("payment_method", "razorpay")
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) throw new Error("Razorpay order not found.");
    if (order.payment_status === "paid") return { ok: true, alreadyPaid: true };

    await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "failed",
        status: "payment_failed",
        operational_status: "payment_failed",
        payment_failure_reason: data.reason || "Razorpay payment failed",
        razorpay_order_id: data.razorpay_order_id || null,
        razorpay_payment_id: data.razorpay_payment_id || null,
      })
      .eq("id", data.orderId);
    await supabaseAdmin.rpc("append_order_event", {
      p_order_id: data.orderId,
      p_event_type: "payment_failed",
      p_label: "Payment Failed",
      p_details: { reason: data.reason || null },
      p_visible_to_customer: true,
    });
    await supabaseAdmin.rpc("log_payment_ledger", {
      p_order_id: data.orderId,
      p_method: "razorpay",
      p_provider: "razorpay",
      p_amount: order.total,
      p_fee: order.payment_fee || 0,
      p_status: "failed",
      p_reference_id: null,
      p_provider_order_id: data.razorpay_order_id || null,
      p_provider_payment_id: data.razorpay_payment_id || null,
      p_failure_reason: data.reason || "Razorpay payment failed",
      p_raw_metadata: {},
    });
    return { ok: true };
  });
