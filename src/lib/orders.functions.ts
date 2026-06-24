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
  payment_method: z.enum(["whatsapp", "upi", "razorpay", "cod", "bank_transfer"]),
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
  method: z.enum(["upi", "bank_transfer"]).optional(),
  payment_utr: z
    .string()
    .trim()
    .min(4, "Enter the UTR or transaction reference")
    .max(80)
    .transform((v) => v.replace(/\s+/g, "").toUpperCase()),
  payment_screenshot_url: z.string().trim().url().max(1000).or(z.literal("")).optional(),
});

const requestRefundSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().positive().max(1_000_000),
  reason: z.string().trim().min(3).max(1000),
  accessToken: z.string().optional(),
});

const resolveRefundSchema = z.object({
  refundId: z.string().uuid(),
  orderId: z.string().uuid(),
  status: z.enum(["approved", "rejected", "completed"]),
  amount: z.number().positive().max(1_000_000).optional(),
  reference: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
  accessToken: z.string().min(20),
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
  standardShippingEnabled: boolean;
  standardDeliveryEstimate: string;
  freeShippingThreshold: number;
  packagingCharge: number;
  expressShippingEnabled: boolean;
  expressShippingFee: number;
  expressDeliveryEstimate: string;
  codAvailable: boolean;
  taxPercentage: number;
  paymentTimeoutMinutes: number;
  estimatedDeliveryDays: string;
};

type PaymentMethodConfig = {
  method_key: string;
  display_name: string;
  enabled: boolean;
  min_order_amount: number;
  max_order_amount: number | null;
  extra_fee: number;
  provider: string;
  public_details: Record<string, unknown> | null;
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

const boolSetting = (rows: Map<string, string>, key: string, fallback: boolean) => {
  const value = rows.get(key);
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
};

async function loadCheckoutSettings(supabaseAdmin: any): Promise<CheckoutSettings> {
  const { data, error } = await supabaseAdmin
    .from("business_settings")
    .select("key,value")
    .in("key", [
      "flat_shipping",
      "standard_shipping_enabled",
      "standard_delivery_estimate",
      "free_shipping_threshold",
      "packaging_charge",
      "express_shipping",
      "express_shipping_fee",
      "express_delivery_estimate",
      "cod_available",
      "tax_percentage",
      "payment_timeout_minutes",
      "estimated_delivery_days",
    ]);
  if (error) throw error;
  const rows = new Map<string, string>((data ?? []).map((row: any) => [row.key, row.value]));
  return {
    flatShipping: numberSetting(rows, "flat_shipping", 99),
    standardShippingEnabled: boolSetting(rows, "standard_shipping_enabled", true),
    standardDeliveryEstimate:
      rows.get("standard_delivery_estimate") || rows.get("estimated_delivery") || "3-7 business days",
    freeShippingThreshold: numberSetting(rows, "free_shipping_threshold", 2500),
    packagingCharge: numberSetting(rows, "packaging_charge", 0),
    expressShippingEnabled: boolSetting(rows, "express_shipping", false),
    expressShippingFee: numberSetting(rows, "express_shipping_fee", 199),
    expressDeliveryEstimate: rows.get("express_delivery_estimate") || "1-3 business days",
    codAvailable: boolSetting(rows, "cod_available", false),
    taxPercentage: numberSetting(rows, "tax_percentage", 0),
    paymentTimeoutMinutes: numberSetting(rows, "payment_timeout_minutes", 30, 1),
    estimatedDeliveryDays: rows.get("estimated_delivery_days") || "3-7",
  };
}

async function loadPaymentMethodConfig(
  supabaseAdmin: any,
  method: string,
): Promise<PaymentMethodConfig | null> {
  if (method === "whatsapp") {
    return {
      method_key: "whatsapp",
      display_name: "WhatsApp",
      enabled: true,
      min_order_amount: 0,
      max_order_amount: null,
      extra_fee: 0,
      provider: "manual_whatsapp",
      public_details: {},
    };
  }
  const { data, error } = await supabaseAdmin
    .from("payment_methods")
    .select("method_key,display_name,enabled,min_order_amount,max_order_amount,extra_fee,provider,public_details")
    .eq("method_key", method)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function assertPaymentMethodAvailable(config: PaymentMethodConfig | null, subtotal: number) {
  if (!config || !config.enabled) throw new Error("Selected payment method is unavailable.");
  if (subtotal < Number(config.min_order_amount || 0)) {
    throw new Error(`${config.display_name} requires a minimum order of ₹${Number(config.min_order_amount).toLocaleString("en-IN")}.`);
  }
  if (config.max_order_amount != null && subtotal > Number(config.max_order_amount)) {
    throw new Error(`${config.display_name} is available only up to ₹${Number(config.max_order_amount).toLocaleString("en-IN")}.`);
  }
}

function resolveShippingMode(settings: CheckoutSettings, express?: boolean) {
  if (express) {
    if (!settings.expressShippingEnabled) throw new Error("Express shipping is currently unavailable.");
    return "express";
  }
  if (settings.standardShippingEnabled) return "standard";
  if (settings.expressShippingEnabled) return "express";
  throw new Error("No shipping method is currently available. Please contact support.");
}

function calculateShipping(subtotal: number, settings: CheckoutSettings, express?: boolean) {
  const mode = resolveShippingMode(settings, express);
  const baseFee = mode === "express" ? settings.expressShippingFee : settings.flatShipping;
  const shipping = subtotal >= settings.freeShippingThreshold || subtotal === 0 ? 0 : baseFee;
  return {
    shipping,
    packaging: settings.packagingCharge,
    estimatedDelivery:
      mode === "express"
        ? settings.expressDeliveryEstimate
        : settings.standardDeliveryEstimate || `${settings.estimatedDeliveryDays} business days`,
    freeShippingEligible: subtotal >= settings.freeShippingThreshold,
    mode,
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
    mode: quote.mode,
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
      mode: quote.mode,
    };
  });

export const createCheckoutOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => createOrderSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let userId: string | null = null;
    if (data.accessToken) {
      const { getSupabaseServerEnv } = await import("@/lib/env.server");
      const authEnv = getSupabaseServerEnv();
      if (authEnv.url && authEnv.publishableKey) {
        const { createClient } = await import("@supabase/supabase-js");
        const userClient = createClient(authEnv.url, authEnv.publishableKey, {
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
    const paymentConfig = await loadPaymentMethodConfig(supabaseAdmin, data.payment_method);
    assertPaymentMethodAvailable(paymentConfig, subtotal);
    if (data.payment_method === "cod" && !checkoutSettings.codAvailable) {
      throw new Error("Cash on Delivery is currently unavailable.");
    }
    const totals = calculateTotals(subtotal, checkoutSettings, data.express || data.shipping_mode === "express");
    const coupon = await applyCouponIfValid(
      supabaseAdmin,
      data.coupon_code,
      userId,
      subtotal,
      totals.shipping,
    );
    const paymentFee = Math.max(0, Number(paymentConfig?.extra_fee || 0));
    const finalTotal = Math.max(0, totals.total + paymentFee - coupon.discount);
    const paymentExpiresAt =
      data.payment_method === "upi" || data.payment_method === "bank_transfer"
        ? new Date(Date.now() + checkoutSettings.paymentTimeoutMinutes * 60 * 1000).toISOString()
        : null;
    const initialPaymentStatus: Record<string, string> = {
      upi: "awaiting_payment",
      bank_transfer: "awaiting_payment",
      cod: "cod_pending",
      razorpay: "pending",
      whatsapp: "pending",
    };
    const initialStatus: Record<string, string> = {
      upi: "awaiting_payment",
      bank_transfer: "awaiting_payment",
      cod: "cod_pending",
      razorpay: "payment_pending",
      whatsapp: "new",
    };
    const initialOperationalStatus: Record<string, string> = {
      upi: "payment_pending",
      bank_transfer: "payment_pending",
      cod: "cod_pending",
      razorpay: "payment_pending",
      whatsapp: "order_created",
    };

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
        payment_fee: paymentFee,
        discount_amount: coupon.discount,
        tax_amount: totals.tax,
        shipping_mode: totals.mode,
        shipping_provider: "manual",
        payment_method: data.payment_method,
        payment_provider: paymentConfig?.provider || null,
        payment_status: initialPaymentStatus[data.payment_method] || "pending",
        status: initialStatus[data.payment_method] || "new",
        operational_status: initialOperationalStatus[data.payment_method] || "order_created",
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

    await supabaseAdmin.rpc("log_payment_ledger", {
      p_order_id: order.id,
      p_method: data.payment_method,
      p_provider: paymentConfig?.provider || "manual",
      p_amount: finalTotal,
      p_fee: paymentFee,
      p_status: initialPaymentStatus[data.payment_method] || "pending",
      p_reference_id: null,
      p_provider_order_id: null,
      p_provider_payment_id: null,
      p_failure_reason: null,
      p_raw_metadata: { source: "checkout" },
    });

    if (["upi", "bank_transfer", "cod"].includes(data.payment_method)) {
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
      paymentFee,
      paymentDetails: paymentConfig?.public_details || {},
      discount: coupon.discount,
      couponCode: coupon.code,
    };
  });

export const submitUpiPaymentReference = createServerFn({ method: "POST" })
  .inputValidator((data) => submitUpiPaymentSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const method = data.method || "upi";
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("orders")
      .select("id,payment_expires_at,payment_status,status,total,payment_fee,payment_provider,razorpay_order_id,razorpay_payment_id")
      .eq("id", data.orderId)
      .eq("payment_method", method)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) throw new Error("Manual payment order not found.");
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
        payment_reference: data.payment_utr,
        payment_screenshot_url: data.payment_screenshot_url || null,
        payment_status: "under_review",
        operational_status: "payment_under_review",
        payment_rejection_reason: null,
        payment_submitted_at: new Date().toISOString(),
      })
      .eq("id", data.orderId)
      .eq("payment_method", method)
      .in("payment_status", ["awaiting_payment", "under_review", "rejected"])
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!order) throw new Error("Could not save payment reference for this order.");
    await supabaseAdmin.rpc("append_order_event", {
      p_order_id: data.orderId,
      p_event_type: "payment_submitted",
      p_label: "Payment Submitted",
      p_details: { payment_reference: data.payment_utr, method },
      p_visible_to_customer: true,
    });
    await supabaseAdmin.rpc("log_payment_ledger", {
      p_order_id: data.orderId,
      p_method: method,
      p_provider: existing.payment_provider || "manual",
      p_amount: existing.total,
      p_fee: existing.payment_fee || 0,
      p_status: "under_review",
      p_reference_id: data.payment_utr,
      p_provider_order_id: existing.razorpay_order_id || null,
      p_provider_payment_id: existing.razorpay_payment_id || null,
      p_failure_reason: null,
      p_raw_metadata: { screenshot_url: data.payment_screenshot_url || null },
    });
    return { ok: true };
  });

export const confirmManualOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => confirmManualOrderSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireOwnerAdmin } = await import("@/lib/admin.server");
    const admin = await requireOwnerAdmin(data.accessToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("confirm_manual_order", {
      p_order_id: data.orderId,
    });
    if (error) throw error;
    await supabaseAdmin
      .from("orders")
      .update({ payment_verified_by: admin.id })
      .eq("id", data.orderId);
    await supabaseAdmin
      .from("payment_ledger")
      .update({ verified_by: admin.id })
      .eq("order_id", data.orderId)
      .in("status", ["approved", "manual_confirmed"]);
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

export const requestRefund = createServerFn({ method: "POST" })
  .inputValidator((data) => requestRefundSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let userId: string | null = null;
    if (data.accessToken) {
      const { getSupabaseServerEnv } = await import("@/lib/env.server");
      const authEnv = getSupabaseServerEnv();
      if (authEnv.url && authEnv.publishableKey) {
        const { createClient } = await import("@supabase/supabase-js");
        const userClient = createClient(authEnv.url, authEnv.publishableKey, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: userResult } = await userClient.auth.getUser(data.accessToken);
        userId = userResult.user?.id ?? null;
      }
    }
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id,user_id,total,order_number")
      .eq("id", data.orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) throw new Error("Order not found.");
    if (order.user_id && userId !== order.user_id) throw new Error("You can only request refunds for your own orders.");
    if (data.amount > Number(order.total || 0)) throw new Error("Refund amount cannot exceed order total.");

    const { data: refund, error } = await supabaseAdmin
      .from("refund_requests")
      .insert({
        order_id: data.orderId,
        requested_by: userId,
        amount: data.amount,
        reason: data.reason,
        status: "requested",
      })
      .select("id")
      .single();
    if (error) throw error;
    await supabaseAdmin
      .from("orders")
      .update({
        refund_status: "refund_requested",
        refund_reason: data.reason,
        refund_amount: data.amount,
      })
      .eq("id", data.orderId);
    await supabaseAdmin.rpc("append_order_event", {
      p_order_id: data.orderId,
      p_event_type: "refund_requested",
      p_label: "Refund Requested",
      p_details: { amount: data.amount, reason: data.reason },
      p_visible_to_customer: true,
    });
    sendOrderStatusEmail({ orderId: data.orderId, templateKey: "refund_initiated" }).catch((error) => {
      console.warn("[orders] refund request email failed", error);
    });
    return { ok: true, refundId: refund.id };
  });

export const resolveRefund = createServerFn({ method: "POST" })
  .inputValidator((data) => resolveRefundSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireOwnerAdmin } = await import("@/lib/admin.server");
    const admin = await requireOwnerAdmin(data.accessToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const statusMap = {
      approved: "refund_approved",
      rejected: "refund_rejected",
      completed: "refund_completed",
    } as const;
    const { data: refund, error: refundError } = await supabaseAdmin
      .from("refund_requests")
      .update({
        status: data.status,
        amount: data.amount,
        refund_reference: data.reference || null,
        admin_notes: data.notes || null,
        resolved_by: admin.id,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.refundId)
      .select("id,amount,provider,order_id")
      .single();
    if (refundError) throw refundError;
    const refundStatus = statusMap[data.status];
    await supabaseAdmin
      .from("orders")
      .update({
        refund_status: refundStatus,
        refund_amount: data.amount ?? refund.amount,
        refund_reference: data.reference || null,
        refund_notes: data.notes || null,
      })
      .eq("id", data.orderId);
    await supabaseAdmin.rpc("append_order_event", {
      p_order_id: data.orderId,
      p_event_type: refundStatus,
      p_label: data.status === "completed" ? "Refund Completed" : data.status === "approved" ? "Refund Approved" : "Refund Rejected",
      p_details: { amount: data.amount ?? refund.amount, reference: data.reference || null, notes: data.notes || null },
      p_visible_to_customer: true,
    });
    if (data.status === "completed") {
      await supabaseAdmin.rpc("log_payment_ledger", {
        p_order_id: data.orderId,
        p_method: "refund",
        p_provider: refund.provider || "manual",
        p_amount: -(data.amount ?? refund.amount),
        p_fee: 0,
        p_status: "refund_completed",
        p_reference_id: data.reference || null,
        p_provider_order_id: null,
        p_provider_payment_id: null,
        p_failure_reason: null,
        p_raw_metadata: { notes: data.notes || null },
      });
    }
    sendOrderStatusEmail({
      orderId: data.orderId,
      templateKey: data.status === "completed" ? "refund_completed" : "refund_initiated",
    }).catch((error) => {
      console.warn("[orders] refund resolution email failed", error);
    });
    return { ok: true };
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
