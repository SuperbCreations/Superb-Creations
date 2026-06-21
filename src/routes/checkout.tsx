import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MessageCircle, CreditCard, Loader2, LogIn } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { inr, whatsappLink } from "@/lib/products";
import { createRazorpayOrder, verifyRazorpayPayment } from "@/lib/razorpay.functions";
import { sendOrderNotifications } from "@/lib/notifications.functions";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Superb Creations" }] }),
  component: Checkout,
});

const schema = z.object({
  customer_name: z.string().trim().min(2, "Please enter your name").max(100),
  phone: z.string().trim().min(8, "Enter a valid phone number").max(20),
  email: z.string().trim().email("Enter a valid email").max(255).or(z.literal("")),
  address: z.string().trim().min(10, "Please enter your full address").max(600),
});

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function Checkout() {
  const navigate = useNavigate();
  const { items, subtotal, clear } = useCart();
  const { user } = useAuth();
  const [form, setForm] = useState({ customer_name: "", phone: "", email: "", address: "" });
  const [method, setMethod] = useState<"whatsapp" | "razorpay">("whatsapp");
  const [busy, setBusy] = useState(false);

  const createOrder = useServerFn(createRazorpayOrder);
  const verifyPayment = useServerFn(verifyRazorpayPayment);
  const notify = useServerFn(sendOrderNotifications);

  const shipping = subtotal >= 2500 || subtotal === 0 ? 0 : 99;
  const total = subtotal + shipping;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const saveOrder = async (paymentMethod: string) => {
    const itemsPayload = items.map((i) => ({
      product_id: i.product_id,
      variant_id: i.variant_id,
      variant_label: i.variant_label,
      name: i.name,
      qty: i.qty,
      price: i.price,
      slug: i.slug,
    }));
    const { data, error } = await supabase
      .from("orders")
      .insert({
        customer_name: form.customer_name,
        phone: form.phone,
        email: form.email || null,
        address: form.address,
        items: itemsPayload,
        total,
        payment_method: paymentMethod,
        user_id: user?.id ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    const orderId = data.id as string;

    // Atomically decrement stock (will silently skip rows that no longer have enough).
    try {
      await supabase.rpc("decrement_stock", {
        p_items: items.map((i) => ({
          product_id: i.product_id,
          variant_id: i.variant_id,
          qty: i.qty,
        })),
      });
    } catch {
      /* non-fatal — admin can reconcile */
    }

    // Fire-and-forget email notification (currently logs server-side; wires to email once domain is verified).
    notify({
      data: {
        orderId,
        customerName: form.customer_name,
        customerEmail: form.email || null,
        customerPhone: form.phone,
        address: form.address,
        items: itemsPayload.map((i) => ({
          name: i.name,
          qty: i.qty,
          price: i.price,
          variant_label: i.variant_label,
        })),
        total,
        paymentMethod,
      },
    }).catch(() => {});

    return orderId;
  };

  const orderSummaryText = () => {
    const lines = items.map((i) => `• ${i.name} × ${i.qty} — ${inr(i.price * i.qty)}`).join("\n");
    return `Hi Superb Creations! I'd like to place an order:\n\n${lines}\n\nSubtotal: ${inr(subtotal)}\nShipping: ${shipping === 0 ? "Free" : inr(shipping)}\nTotal: ${inr(total)}\n\nName: ${form.customer_name}\nPhone: ${form.phone}\nAddress: ${form.address}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setBusy(true);
    try {
      if (method === "whatsapp") {
        await saveOrder("whatsapp");
        const url = whatsappLink(orderSummaryText());
        clear();
        window.open(url, "_blank");
        navigate({ to: "/order-success", search: { method: "whatsapp" } });
        return;
      }

      // Razorpay
      const orderId = await saveOrder("razorpay");
      const res = await createOrder({ data: { amount: total * 100, orderId } });
      if (!res.configured) {
        toast.error(
          "Online payment isn't available yet. Please use 'Order on WhatsApp' to complete your order.",
        );
        setBusy(false);
        return;
      }
      const ok = await loadRazorpay();
      if (!ok) {
        toast.error("Could not load the payment window. Please try again.");
        setBusy(false);
        return;
      }

      const rzp = new (window as any).Razorpay({
        key: res.keyId,
        amount: res.amount,
        currency: "INR",
        name: "Superb Creations",
        description: "Boutique order",
        order_id: res.razorpayOrderId,
        prefill: { name: form.customer_name, email: form.email, contact: form.phone },
        theme: { color: "#b07a86" },
        handler: async (response: any) => {
          try {
            const v = await verifyPayment({
              data: {
                orderId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            });
            if (v.ok) {
              clear();
              navigate({ to: "/order-success", search: { method: "razorpay" } });
            } else {
              toast.error("Payment could not be verified. Please contact us on WhatsApp.");
            }
          } catch {
            toast.error("Payment verification failed. Please contact us on WhatsApp.");
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not place order.");
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return (
      <section className="container-boutique py-24 text-center">
        <h1 className="font-display text-4xl">Checkout</h1>
        <p className="mt-4 text-muted-foreground">Your bag is empty.</p>
        <Link
          to="/shop"
          className="mt-6 inline-block rounded-full bg-primary px-7 py-3 text-xs uppercase tracking-[0.22em] text-primary-foreground"
        >
          Start shopping
        </Link>
      </section>
    );
  }

  return (
    <section className="container-boutique py-12 md:py-16">
      <h1 className="font-display text-4xl md:text-5xl">Checkout</h1>

      {!user && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-secondary/40 p-4">
          <p className="text-sm text-muted-foreground">
            Sign in for faster checkout and to track your order history.
          </p>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 px-5 py-2 text-xs uppercase tracking-[0.2em] hover:bg-primary hover:text-primary-foreground"
          >
            <LogIn size={13} /> Sign in
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-8">
          <div>
            <h2 className="font-display text-2xl">Delivery details</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <input
                required
                placeholder="Full name"
                value={form.customer_name}
                onChange={set("customer_name")}
                className="rounded-md border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary sm:col-span-2"
              />
              <input
                required
                placeholder="Phone (WhatsApp)"
                value={form.phone}
                onChange={set("phone")}
                className="rounded-md border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              />
              <input
                type="email"
                placeholder="Email (optional)"
                value={form.email}
                onChange={set("email")}
                className="rounded-md border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              />
              <textarea
                required
                placeholder="Full delivery address with pincode"
                value={form.address}
                onChange={set("address")}
                rows={3}
                className="rounded-md border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary sm:col-span-2"
              />
            </div>
          </div>

          <div>
            <h2 className="font-display text-2xl">Payment</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMethod("whatsapp")}
                className={
                  "flex items-start gap-3 rounded-md border p-4 text-left transition-colors " +
                  (method === "whatsapp" ? "border-primary bg-primary/5" : "border-border")
                }
              >
                <MessageCircle size={20} className="mt-0.5 shrink-0" />
                <span>
                  <span className="block text-sm font-medium">Order on WhatsApp</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Confirm details & pay over chat. Fastest.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMethod("razorpay")}
                className={
                  "flex items-start gap-3 rounded-md border p-4 text-left transition-colors " +
                  (method === "razorpay" ? "border-primary bg-primary/5" : "border-border")
                }
              >
                <CreditCard size={20} className="mt-0.5 shrink-0" />
                <span>
                  <span className="block text-sm font-medium">Pay online</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Cards, UPI & netbanking via Razorpay.
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-sm border border-border bg-secondary/30 p-6">
          <h2 className="font-display text-2xl">Your order</h2>
          <div className="mt-5 space-y-3">
            {items.map((i) => (
              <div key={i.id} className="flex justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  {i.name} × {i.qty}
                </span>
                <span>{inr(i.price * i.qty)}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{inr(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>{shipping === 0 ? "Free" : inr(shipping)}</span>
            </div>
          </div>
          <div className="mt-4 flex justify-between border-t border-border pt-4 font-display text-lg">
            <span>Total</span>
            <span>{inr(total)}</span>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-xs uppercase tracking-[0.22em] text-primary-foreground disabled:opacity-60"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {method === "whatsapp" ? "Place order on WhatsApp" : `Pay ${inr(total)}`}
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Free shipping on orders over ₹2,500.
          </p>
        </aside>
      </form>
    </section>
  );
}
