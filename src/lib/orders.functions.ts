import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sendOrderNotificationsForOrder } from "@/lib/notifications.functions";

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
  payment_method: z.enum(["whatsapp", "razorpay"]),
  items: z.array(cartItemSchema).min(1).max(50),
  accessToken: z.string().optional(),
});

const confirmManualOrderSchema = z.object({
  orderId: z.string().uuid(),
  accessToken: z.string().min(20),
});

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  price: number;
  image_url: string;
  in_stock: boolean;
  stock: number;
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

function shippingForSubtotal(subtotal: number) {
  return subtotal >= 2500 || subtotal === 0 ? 0 : 99;
}

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
      .select("id,slug,name,price,image_url,in_stock,stock")
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
      if (!product || !product.in_stock) {
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
    const shipping = shippingForSubtotal(subtotal);
    const total = subtotal + shipping;

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_name: data.customer_name,
        phone: data.phone,
        email: data.email || null,
        address: data.address,
        items: orderItems,
        total,
        payment_method: data.payment_method,
        payment_status: "pending",
        status: "new",
        user_id: userId,
      })
      .select("id,total")
      .single();
    if (orderError) throw orderError;

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
      total,
      paymentMethod: data.payment_method,
    }).catch((error) => {
      console.warn("[orders] notification send failed", error);
    });

    return {
      orderId: order.id as string,
      items: orderItems,
      subtotal,
      shipping,
      total,
      paymentMethod: data.payment_method,
    };
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
    return result;
  });
