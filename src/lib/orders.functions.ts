import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sendOrderNotificationsForOrder, sendOrderStatusEmail } from "@/lib/notifications.functions";

const cartItemSchema = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().nullable().optional(),
  qty: z.number().int().positive().max(50),
});

const createOrderSchema = z.object({
  customer_name: z.string().trim().min(2).max(100).transform((v) => v.replace(/\s+/g, " ")),
  phone: z.string().trim().min(8).max(20).transform((v) => v.replace(/[^\d+]/g, "")),
  email: z.string().trim().toLowerCase().email().max(255).or(z.literal("")),
  address: z.string().trim().min(10).max(600).transform((v) => v.replace(/\s+/g, " ")),
  payment_method: z.enum(["whatsapp", "upi", "razorpay"]),
  coupon_code: z.string().trim().max(80).optional(),
  pincode: z.string().trim().max(12).optional(),
  shipping_mode: z.enum(["standard", "express"]).optional(),
  express: z.boolean().optional(),
  items: z.array(cartItemSchema).min(1).max(50),
  accessToken: z.string().optional(),
});

const shippingQuoteSchema = z.object({
  subtotal: z.number().nonnegative(),
  pincode: z.string().trim().max(12).optional(),
  shipping_mode: z.enum(["standard", "express"]).optional(),
  express: z.boolean().optional(),
  items: z.array(cartItemSchema).min(1).max(50).optional(),
});

const confirmManualOrderSchema = z.object({
  orderId: z.string().uuid(),
  accessToken: z.string().min(20),
});

const submitUpiPaymentSchema = z.object({
  orderId: z.string().uuid(),
  payment_utr: z
    .string()
    .trim()
    .min(4, "Enter the UTR or transaction reference")
    .max(80)
    .transform((v) => v.replace(/\s+/g, "").toUpperCase()),
  payment_screenshot_url: z.string().trim().url().max(1000).or(z.literal("")).optional(),
});

const rejectManualPaymentSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
  accessToken: z.string().min(20),
});

const expireUpiOrderSchema = z.object({
  orderId: z.string().uuid(),
});

const updateOrderOperationsSchema = z.object({
  orderId: z.string().uuid(),
  accessToken: z.string().min(20),
  operational_status: z.string().trim().max(80).optional(),
  shipping_status: z.string().trim().max(80).optional(),
  shipping_provider: z.string().trim().max(80).optional(),
  courier_name: z.string().trim().max(120).optional(),
  tracking_number: z.string().trim().max(160).optional(),
  estimated_delivery_date: z.string().trim().max(20).optional(),
  dispatch_date: z.string().trim().max(20).optional(),
  delivery_date: z.string().trim().max(20).optional(),
  shipping_notes: z.string().trim().max(1000).optional(),
  tracking_url: z.string().trim().max(1000).optional(),
  internal_notes: z.string().trim().max(2000).optional(),
  refund_status: z.string().trim().max(80).optional(),
  refund_reason: z.string().trim().max(1000).optional(),
  event_label: z.string().trim().max(160).optional(),
  visible_to_customer: z.boolean().optional(),
});

const adjustInventorySchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(-100000).max(100000).refine((n) => n !== 0),
  movementType: z.string().trim().min(1).max(80),
  note: z.string().trim().max(500).optional(),
  accessToken: z.string().min(20),
});

const bulkOrderSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(100),
  operational_status: z.string().trim().max(80),
  shipping_status: z.string().trim().max(80).optional(),
  event_label: z.string().trim().max(160).optional(),
  accessToken: z.string().min(20),
});

const shipmentActionSchema = z.object({
  orderId: z.string().uuid(),
  accessToken: z.string().min(20),
  provider: z.string().trim().max(80).optional(),
});

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  price: number;
  image_url: string;
  active: boolean;
  in_stock: boolean;
  stock: number;
  weight_grams?: number;
  free_shipping_eligible?: boolean;
  special_packaging?: boolean;
  shipping_class?: string;
};

type VariantRow = {
  id: string;
  product_id: string;
  size: string;
  color: string;
  price: number | null;
  stock: number;
};

function variantLabel(variant: Pick<VariantRow, "size" | "color">) {
  return [variant.size, variant.color].filter(Boolean).join(" - ") || "Default";
}

type CheckoutSettings = {
  flatShipping: number;
  freeShippingThreshold: number;
  packagingCharge: number;
  expressShippingFee: number;
  taxPercentage: number;
  paymentTimeoutMinutes: number;
  estimatedDeliveryDays: string;
};

const numberSetting = (
  rows: Map<string, string>,
  key: string,
  fallback: number,
  min = 0,
) => {
  const n = Number(rows.get(key));
  return Number.isFinite(n) && n >= min ? n : fallback;
};

async function loadCheckoutSettings(supabaseAdmin: any): Promise<CheckoutSettings> {
  const { data, error } = await supabaseAdmin
    .from("business_settings")
    .select("key,value")
    .in("key", [
      "flat_shipping",
      "free_shipping_threshold",
      "packaging_charge",
      "express_shipping_fee",
      "tax_percentage",
      "payment_timeout_minutes",
      "estimated_delivery_days",
    ]);
  if (error) throw error;
  const rows = new Map<string, string>((data ?? []).map((row: any) => [row.key, row.value]));
  return {
    flatShipping: numberSetting(rows, "flat_shipping", 99),
    freeShippingThreshold: numberSetting(rows, "free_shipping_threshold", 2500),
    packagingCharge: numberSetting(rows, "packaging_charge", 0),
    expressShippingFee: numberSetting(rows, "express_shipping_fee", 199),
    taxPercentage: numberSetting(rows, "tax_percentage", 0),
    paymentTimeoutMinutes: numberSetting(rows, "payment_timeout_minutes", 30, 1),
    estimatedDeliveryDays: rows.get("estimated_delivery_days") || "3-7",
  };
}

function calculateShipping(subtotal: number, settings: CheckoutSettings, express?: boolean) {
  const shipping =
    subtotal >= settings.freeShippingThreshold || subtotal === 0 ? 0 : settings.flatShipping;
  const expressFee = express ? settings.expressShippingFee : 0;
  return {
    shipping: shipping + expressFee,
    packaging: settings.packagingCharge,
    estimatedDelivery: express ? "1-3 business days" : `${settings.estimatedDeliveryDays} business days`,
    freeShippingEligible: subtotal >= settings.freeShippingThreshold,
  };
}

function calculateTotals(subtotal: number, settings: CheckoutSettings, express?: boolean) {
  const quote = calculateShipping(subtotal, settings, express);
  const shipping = quote.shipping;
  const packaging = quote.packaging;
  const tax = Math.round(((subtotal + shipping + packaging) * settings.taxPercentage) / 100);
  return {
    shipping,
    packaging,
    tax,
    total: subtotal + shipping + packaging + tax,
    estimatedDelivery: quote.estimatedDelivery,
    freeShippingEligible: quote.freeShippingEligible,
  };
}

async function applyCouponIfValid(
  supabaseAdmin: any,
  code: string | undefined,
  userId: string | null,
  subtotal: number,
  shipping: number,
) {
  if (!code) return { discount: 0, couponId: null as string | null, code: "" };
  const { data, error } = await supabaseAdmin.rpc("validate_coupon", {
    p_code: code,
    p_user_id: userId,
    p_subtotal: subtotal,
    p_shipping: shipping,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || "Coupon could not be applied.");
  return {
    discount: Math.max(0, Number(data.discount_amount || 0)),
    couponId: data.coupon_id as string | null,
    code: data.code as string,
  };
}

export const calculateShippingQuote = createServerFn({ method: "POST" })
  .inputValidator((data) => shippingQuoteSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const settings = await loadCheckoutSettings(supabaseAdmin);
    const quote = calculateShipping(data.subtotal, settings, data.express || data.shipping_mode === "express");
    return {
      shipping: quote.shipping,
      packaging: quote.packaging,
      estimatedDelivery: quote.estimatedDelivery,
      freeShippingEligible: quote.freeShippingEligible,
      deliveryAvailable: true,
      pincode: data.pincode || "",
      mode: data.express || data.shipping_mode === "express" ? "express" : "standard",
    };
  });

export const createCheckoutOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => createOrderSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let userId: string | null = null;
    if (data.accessToken) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
      if (supabaseUrl && publishableKey) {
        const { createClient } = await import("@supabase/supabase-js");
        const userClient = createClient(supabaseUrl, publishableKey, {
          auth: {
            storage: undefined,
            persistSession: false,
            autoRefreshToken: false,
          },
        });
        const { data: userResult } = await userClient.auth.getUser(data.accessToken);
        userId = userResult.user?.id ?? null;
      }
    }

    const normalizedItems = new Map<
      string,
      { product_id: string; variant_id: string | null; qty: number }
    >();
    for (const item of data.items) {
      const variantId = item.variant_id ?? null;
      const key = `${item.product_id}:${variantId ?? "base"}`;
      const existing = normalizedItems.get(key);
      normalizedItems.set(key, {
        product_id: item.product_id,
        variant_id: variantId,
        qty: (existing?.qty ?? 0) + item.qty,
      });
    }

    const cartItems = [...normalizedItems.values()];
    const productIds = [...new Set(cartItems.map((item) => item.product_id))];
    const variantIds = [
      ...new Set(cartItems.map((item) => item.variant_id).filter(Boolean)),
    ] as string[];

    const { data: products, error: productsError } = await supabaseAdmin
      .from("products")
      .select("id,slug,name,price,image_url,active,in_stock,stock,weight_grams,free_shipping_eligible,special_packaging,shipping_class")
      .in("id", productIds);
    if (productsError) throw productsError;

    const variantsResult =
      variantIds.length > 0
        ? await supabaseAdmin
            .from("product_variants")
            .select("id,product_id,size,color,price,stock")
            .in("id", variantIds)
        : { data: [] as VariantRow[], error: null };
    if (variantsResult.error) throw variantsResult.error;

    const productsById = new Map((products ?? []).map((p) => [p.id, p as ProductRow]));
    const variantsById = new Map(
      (variantsResult.data ?? []).map((v) => [v.id, v as VariantRow]),
    );

    const orderItems = cartItems.map((item) => {
      const product = productsById.get(item.product_id);
      if (!product || !product.active || !product.in_stock) {
        throw new Error("One or more items are no longer available.");
      }

      const variant = item.variant_id ? variantsById.get(item.variant_id) : null;
      if (item.variant_id && (!variant || variant.product_id !== product.id)) {
        throw new Error("One or more selected variants are invalid.");
      }

      const stock = variant ? variant.stock : product.stock;
      if (stock < item.qty) {
        throw new Error(`${product.name} has only ${Math.max(stock, 0)} left in stock.`);
      }

      const price = variant?.price ?? product.price;
      return {
        product_id: product.id,
        variant_id: variant?.id ?? null,
        variant_label: variant ? variantLabel(variant) : null,
        name: product.name,
        qty: item.qty,
        price,
        slug: product.slug,
        image_url: product.image_url,
      };
    });

    const subtotal = orderItems.reduce((sum, item) => sum + item.qty * item.price, 0);
    const checkoutSettings = await loadCheckoutSettings(supabaseAdmin);
    const totals = calculateTotals(subtotal, checkoutSettings, data.express || data.shipping_mode === "express");
    const coupon = await applyCouponIfValid(
      supabaseAdmin,
      data.coupon_code,
      userId,
      subtotal,
      totals.shipping,
    );
    const finalTotal = Math.max(0, totals.total - coupon.discount);
    const paymentExpiresAt =
      data.payment_method === "upi"
        ? new Date(Date.now() + checkoutSettings.paymentTimeoutMinutes * 60 * 1000).toISOString()
        : null;

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_name: data.customer_name,
        phone: data.phone,
        email: data.email || null,
        address: data.address,
        items: orderItems,
        total: finalTotal,
        subtotal_amount: subtotal,
        shipping_fee: totals.shipping,
        packaging_fee: totals.packaging,
        discount_amount: coupon.discount,
        tax_amount: totals.tax,
        shipping_mode: data.express || data.shipping_mode === "express" ? "express" : "standard",
        shipping_provider: "manual",
        payment_method: data.payment_method,
        payment_status: data.payment_method === "upi" ? "awaiting_payment" : "pending",
        status: data.payment_method === "upi" ? "awaiting_payment" : "new",
        payment_expires_at: paymentExpiresAt,
        user_id: userId,
      })
      .select("id,total")
      .single();
    if (orderError) throw orderError;

    if (coupon.couponId) {
      await supabaseAdmin.from("coupon_redemptions").insert({
        coupon_id: coupon.couponId,
        user_id: userId,
        order_id: order.id,
        discount_amount: coupon.discount,
      });
      await supabaseAdmin.rpc("append_order_event", {
        p_order_id: order.id,
        p_event_type: "coupon_applied",
        p_label: `Coupon Applied (${coupon.code})`,
        p_details: { discount_amount: coupon.discount },
        p_visible_to_customer: true,
      });
    }

    await supabaseAdmin.rpc("append_order_event", {
      p_order_id: order.id,
      p_event_type: "order_created",
      p_label: "Order Created",
      p_details: { payment_method: data.payment_method },
      p_visible_to_customer: true,
    });

    if (data.payment_method === "upi") {
      const { error: reserveError } = await supabaseAdmin.rpc("apply_order_stock_locked", {
        p_order_id: order.id,
      });
      if (reserveError) {
        await supabaseAdmin.from("orders").delete().eq("id", order.id);
        throw reserveError;
      }
    }

    sendOrderNotificationsForOrder({
      orderId: order.id,
      customerName: data.customer_name,
      customerEmail: data.email || null,
      customerPhone: data.phone,
      address: data.address,
      items: orderItems.map((item) => ({
        name: item.name,
        qty: item.qty,
        price: item.price,
        variant_label: item.variant_label,
      })),
      total: finalTotal,
      paymentMethod: data.payment_method,
    }).catch((error) => {
      console.warn("[orders] notification send failed", error);
    });

    return {
      orderId: order.id as string,
      items: orderItems,
      subtotal,
      shipping: totals.shipping,
      packaging: totals.packaging,
      tax: totals.tax,
      estimatedDelivery: totals.estimatedDelivery,
      total: finalTotal,
      paymentMethod: data.payment_method,
      paymentExpiresAt,
      discount: coupon.discount,
      couponCode: coupon.code,
    };
  });

export const submitUpiPaymentReference = createServerFn({ method: "POST" })
  .inputValidator((data) => submitUpiPaymentSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("orders")
      .select("id,payment_expires_at,payment_status,status")
      .eq("id", data.orderId)
      .eq("payment_method", "upi")
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) throw new Error("UPI order not found.");
    if (existing.payment_status === "expired" || existing.status === "expired") {
      throw new Error("This payment link has expired. Please generate a new order.");
    }
    if (existing.payment_expires_at && new Date(existing.payment_expires_at).getTime() <= Date.now()) {
      await supabaseAdmin.rpc("expire_upi_order", { p_order_id: data.orderId });
      throw new Error("This payment link has expired. Please generate a new order.");
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .update({
        payment_utr: data.payment_utr,
        payment_screenshot_url: data.payment_screenshot_url || null,
        payment_status: "under_review",
        operational_status: "payment_under_review",
        payment_rejection_reason: null,
        payment_submitted_at: new Date().toISOString(),
      })
      .eq("id", data.orderId)
      .eq("payment_method", "upi")
      .in("payment_status", ["awaiting_payment", "under_review", "rejected"])
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!order) throw new Error("Could not save payment reference for this order.");
    await supabaseAdmin.rpc("append_order_event", {
      p_order_id: data.orderId,
      p_event_type: "payment_submitted",
      p_label: "Payment Submitted",
      p_details: { payment_utr: data.payment_utr },
      p_visible_to_customer: true,
    });
    return { ok: true };
  });

export const confirmManualOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => confirmManualOrderSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireOwnerAdmin } = await import("@/lib/admin.server");
    await requireOwnerAdmin(data.accessToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("confirm_manual_order", {
      p_order_id: data.orderId,
    });
    if (error) throw error;
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("user_id,total,order_number")
      .eq("id", data.orderId)
      .maybeSingle();
    if (order?.user_id) {
      await supabaseAdmin.rpc("add_loyalty_points", {
        p_user_id: order.user_id,
        p_points: Math.floor(Number(order.total || 0) / 100),
        p_reason: "Purchase",
        p_order_id: data.orderId,
      });
      await supabaseAdmin.from("notifications").insert({
        user_id: order.user_id,
        type: "order_update",
        title: "Payment approved",
        body: `Your order ${order.order_number || data.orderId.slice(0, 8)} is confirmed.`,
        link_url: "/account",
      });
    }
    sendOrderStatusEmail({ orderId: data.orderId, templateKey: "payment_approved" }).catch((error) => {
      console.warn("[orders] payment approved email failed", error);
    });
    return result;
  });

export const rejectManualPayment = createServerFn({ method: "POST" })
  .inputValidator((data) => rejectManualPaymentSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireOwnerAdmin } = await import("@/lib/admin.server");
    await requireOwnerAdmin(data.accessToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("reject_manual_payment", {
      p_order_id: data.orderId,
      p_reason: data.reason || null,
    });
    if (error) throw error;
    await supabaseAdmin.rpc("append_order_event", {
      p_order_id: data.orderId,
      p_event_type: "payment_rejected",
      p_label: "Payment Rejected",
      p_details: { reason: data.reason || null },
      p_visible_to_customer: true,
    });
    sendOrderStatusEmail({
      orderId: data.orderId,
      templateKey: "payment_rejected",
      variables: { reason: data.reason || "" },
    }).catch((error) => {
      console.warn("[orders] payment rejected email failed", error);
    });
    return result;
  });

export const expireUpiOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => expireUpiOrderSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("expire_upi_order", {
      p_order_id: data.orderId,
    });
    if (error) throw error;
    await supabaseAdmin.rpc("append_order_event", {
      p_order_id: data.orderId,
      p_event_type: "expired",
      p_label: "Payment Expired",
      p_details: {},
      p_visible_to_customer: true,
    });
    return result;
  });

export const updateOrderOperations = createServerFn({ method: "POST" })
  .inputValidator((data) => updateOrderOperationsSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireOwnerAdmin } = await import("@/lib/admin.server");
    await requireOwnerAdmin(data.accessToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const toDate = (value?: string) => (value ? value : null);
    const { data: result, error } = await supabaseAdmin.rpc("update_order_operations", {
      p_order_id: data.orderId,
      p_operational_status: data.operational_status || null,
      p_shipping_status: data.shipping_status || null,
      p_courier_name: data.courier_name || null,
      p_tracking_number: data.tracking_number || null,
      p_estimated_delivery_date: toDate(data.estimated_delivery_date),
      p_dispatch_date: toDate(data.dispatch_date),
      p_delivery_date: toDate(data.delivery_date),
      p_shipping_notes: data.shipping_notes ?? null,
      p_internal_notes: data.internal_notes ?? null,
      p_refund_status: data.refund_status || null,
      p_refund_reason: data.refund_reason ?? null,
      p_event_label: data.event_label || null,
      p_visible_to_customer: data.visible_to_customer ?? true,
    });
    if (error) throw error;
    if (data.tracking_url !== undefined) {
      const { error: trackingUrlError } = await supabaseAdmin
        .from("orders")
        .update({ tracking_url: data.tracking_url || null })
        .eq("id", data.orderId);
      if (trackingUrlError) throw trackingUrlError;
    }
    if (data.shipping_provider !== undefined) {
      const { error: providerError } = await supabaseAdmin
        .from("orders")
        .update({ shipping_provider: data.shipping_provider || "manual" })
        .eq("id", data.orderId);
      if (providerError) throw providerError;
    }
    const shipmentStatus = data.shipping_status || data.operational_status;
    if (shipmentStatus || data.tracking_number || data.courier_name || data.tracking_url) {
      await supabaseAdmin.from("shipment_events").insert({
        order_id: data.orderId,
        status: shipmentStatus || "tracking_updated",
        courier_name: data.courier_name || null,
        tracking_number: data.tracking_number || null,
        tracking_url: data.tracking_url || null,
        notes: data.shipping_notes || data.event_label || null,
        visible_to_customer: data.visible_to_customer ?? true,
      });
    }
    const emailByStatus: Record<string, string> = {
      packed: "order_packed",
      ready_to_ship: "order_ready_to_ship",
      shipped: "order_shipped",
      in_transit: "order_shipped",
      out_for_delivery: "order_out_for_delivery",
      delivered: "order_delivered",
      delivery_failed: "order_delivery_failed",
      returned_to_origin: "order_returned_to_origin",
      cancelled: "order_cancelled",
      refund_initiated: "refund_initiated",
      refund_completed: "refund_completed",
    };
    const statusKey = data.operational_status || data.shipping_status || data.refund_status;
    const templateKey = statusKey ? emailByStatus[statusKey] : null;
    if (statusKey || data.tracking_number || data.estimated_delivery_date) {
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("user_id,order_number")
        .eq("id", data.orderId)
        .maybeSingle();
      if (order?.user_id) {
        await supabaseAdmin.from("notifications").insert({
          user_id: order.user_id,
          type: "shipping_update",
          title: "Shipping update",
          body: `Order ${order.order_number || data.orderId.slice(0, 8)}: ${data.event_label || statusKey || "tracking updated"}.`,
          link_url: "/account",
        });
      }
    }
    if (templateKey || data.tracking_number || data.estimated_delivery_date) {
      sendOrderStatusEmail({
        orderId: data.orderId,
        templateKey: templateKey || "order_shipped",
        variables: {
          tracking_info: [data.courier_name, data.tracking_number, data.estimated_delivery_date]
            .filter(Boolean)
            .join(" · "),
        },
      }).catch((emailError) => {
        console.warn("[orders] status email failed", emailError);
      });
    }
    return result;
  });

export const createShipment = createServerFn({ method: "POST" })
  .inputValidator((data) => shipmentActionSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireOwnerAdmin } = await import("@/lib/admin.server");
    await requireOwnerAdmin(data.accessToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const provider = data.provider || "manual";
    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        shipping_provider: provider,
        shipping_status: provider === "manual" ? "not_shipped" : "shipment_requested",
        operational_status: "ready_to_ship",
      })
      .eq("id", data.orderId);
    if (error) throw error;
    await supabaseAdmin.from("shipment_events").insert({
      order_id: data.orderId,
      status: provider === "manual" ? "manual_mode" : "shipment_requested",
      courier_name: provider === "manual" ? "Manual" : provider,
      notes: provider === "manual" ? "Manual shipping mode active." : "Provider shipment placeholder created.",
      visible_to_customer: false,
    });
    return { ok: true, provider, mode: provider === "manual" ? "manual" : "provider_stub" };
  });

export const cancelShipment = createServerFn({ method: "POST" })
  .inputValidator((data) => shipmentActionSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireOwnerAdmin } = await import("@/lib/admin.server");
    await requireOwnerAdmin(data.accessToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ shipping_status: "cancelled", operational_status: "cancelled" })
      .eq("id", data.orderId);
    if (error) throw error;
    await supabaseAdmin.from("shipment_events").insert({
      order_id: data.orderId,
      status: "cancelled",
      notes: "Shipment cancelled.",
      visible_to_customer: true,
    });
    return { ok: true };
  });

export const fetchTracking = createServerFn({ method: "POST" })
  .inputValidator((data) => shipmentActionSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireOwnerAdmin } = await import("@/lib/admin.server");
    await requireOwnerAdmin(data.accessToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id,shipping_provider,shipping_status,courier_name,tracking_number,tracking_url,estimated_delivery_date")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw error;
    return { ok: true, manual: true, tracking: order };
  });

export const syncShipmentStatus = createServerFn({ method: "POST" })
  .inputValidator((data) => shipmentActionSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireOwnerAdmin } = await import("@/lib/admin.server");
    await requireOwnerAdmin(data.accessToken);
    return { ok: true, mode: "manual_fallback" };
  });

export const adjustInventoryStock = createServerFn({ method: "POST" })
  .inputValidator((data) => adjustInventorySchema.parse(data))
  .handler(async ({ data }) => {
    const { requireOwnerAdmin } = await import("@/lib/admin.server");
    await requireOwnerAdmin(data.accessToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("adjust_inventory_stock", {
      p_product_id: data.productId,
      p_variant_id: data.variantId || null,
      p_quantity: data.quantity,
      p_movement_type: data.movementType,
      p_note: data.note || null,
    });
    if (error) throw error;
    return result;
  });

export const bulkUpdateOrders = createServerFn({ method: "POST" })
  .inputValidator((data) => bulkOrderSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireOwnerAdmin } = await import("@/lib/admin.server");
    await requireOwnerAdmin(data.accessToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const orderId of data.orderIds) {
      const { error } = await supabaseAdmin.rpc("update_order_operations", {
        p_order_id: orderId,
        p_operational_status: data.operational_status,
        p_shipping_status: data.shipping_status || null,
        p_courier_name: null,
        p_tracking_number: null,
        p_estimated_delivery_date: null,
        p_dispatch_date: null,
        p_delivery_date: null,
        p_shipping_notes: null,
        p_internal_notes: null,
        p_refund_status: null,
        p_refund_reason: null,
        p_event_label: data.event_label || null,
        p_visible_to_customer: true,
      });
      if (error) throw error;
    }
    return { ok: true, updated: data.orderIds.length };
  });
