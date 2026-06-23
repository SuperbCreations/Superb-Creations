import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Loader2, LogIn, Smartphone, Upload } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { toDataURL } from "qrcode";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/products";
import {
  settingBool,
  settingNumber,
  useBusinessSettings,
  whatsappUrl,
} from "@/lib/business-settings";
import { useCustomerAddresses, useValidateCoupon } from "@/lib/customer-engagement";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  calculateShippingQuote,
  createCheckoutOrder,
  expireUpiOrder,
  submitUpiPaymentReference,
} from "@/lib/orders.functions";
import { supabase } from "@/integrations/supabase/client";

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

type CheckoutOrderResult = {
  orderId: string;
  items: Array<{ name: string; qty: number; price: number }>;
  subtotal: number;
  shipping: number;
  total: number;
  packaging?: number;
  tax?: number;
  discount?: number;
  couponCode?: string;
  estimatedDelivery?: string;
  paymentMethod: string;
  paymentExpiresAt: string | null;
};

function Checkout() {
  const navigate = useNavigate();
  const { items, subtotal, clear } = useCart();
  const { user, session } = useAuth();
  const { settings } = useBusinessSettings();
  const { data: addresses = [] } = useCustomerAddresses(user?.id);
  const validateCoupon = useValidateCoupon();
  const [form, setForm] = useState({ customer_name: "", phone: "", email: "", address: "" });
  const [method, setMethod] = useState<"whatsapp" | "upi">("whatsapp");
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState("");
  const [pincode, setPincode] = useState("");
  const [shippingMode, setShippingMode] = useState<"standard" | "express">("standard");
  const [shippingQuote, setShippingQuote] = useState<{
    shipping: number;
    packaging: number;
    estimatedDelivery: string;
    freeShippingEligible: boolean;
    deliveryAvailable: boolean;
    mode: string;
  } | null>(null);
  const [upiOrder, setUpiOrder] = useState<CheckoutOrderResult | null>(null);
  const [upiQr, setUpiQr] = useState("");
  const [utr, setUtr] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [now, setNow] = useState(Date.now());
  const [expired, setExpired] = useState(false);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [busy, setBusy] = useState(false);

  const createOrder = useServerFn(createCheckoutOrder);
  const quoteShipping = useServerFn(calculateShippingQuote);
  const submitUpiPayment = useServerFn(submitUpiPaymentReference);
  const expireOrder = useServerFn(expireUpiOrder);

  const checkoutSettings = settings;
  const checkoutEnabled = settingBool(checkoutSettings, "enable_checkout");
  const whatsappEnabled = settingBool(checkoutSettings, "enable_whatsapp");
  const upiEnabled = settingBool(checkoutSettings, "enable_upi");
  const taxPercentage = settingNumber(checkoutSettings, "tax_percentage");
  const shipping = shippingQuote?.shipping ?? 0;
  const packagingCharge = shippingQuote?.packaging ?? 0;
  const tax = Math.round(((subtotal + shipping + packagingCharge) * taxPercentage) / 100);
  const total = Math.max(0, subtotal + shipping + packagingCharge + tax - couponDiscount);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const saveOrder = async (paymentMethod: "whatsapp" | "upi") =>
    createOrder({
      data: {
        customer_name: form.customer_name,
        phone: form.phone,
        email: form.email,
        address: form.address,
        payment_method: paymentMethod,
        coupon_code: couponCode.trim() || undefined,
        pincode: pincode.trim() || undefined,
        shipping_mode: shippingMode,
        express: shippingMode === "express",
        accessToken: session?.access_token,
        items: items.map((i) => ({
          product_id: i.product_id,
          variant_id: i.variant_id,
          qty: i.qty,
        })),
      },
    });

  useEffect(() => {
    if (!whatsappEnabled && upiEnabled) setMethod("upi");
    if (whatsappEnabled && !upiEnabled) setMethod("whatsapp");
  }, [upiEnabled, whatsappEnabled]);

  useEffect(() => {
    if (items.length > 0) {
      trackAnalyticsEvent({
        eventType: "checkout_started",
        userId: user?.id,
        metadata: { itemCount: items.length, subtotal },
      });
    }
  }, [items.length, subtotal, user?.id]);

  useEffect(() => {
    if (items.length === 0) {
      setShippingQuote(null);
      return;
    }
    let cancelled = false;
    quoteShipping({
      data: {
        subtotal,
        pincode: pincode.trim() || undefined,
        shipping_mode: shippingMode,
        express: shippingMode === "express",
        items: items.map((i) => ({
          product_id: i.product_id,
          variant_id: i.variant_id,
          qty: i.qty,
        })),
      },
    })
      .then((quote) => {
        if (!cancelled) setShippingQuote(quote);
      })
      .catch(() => {
        if (!cancelled) setShippingQuote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [items, pincode, quoteShipping, shippingMode, subtotal]);

  const businessName = checkoutSettings.business_name || "Superb Creations";
  const upiId = checkoutSettings.upi_id;
  const upiIntent = useMemo(() => {
    if (!upiOrder) return "";
    const params = new URLSearchParams({
      pa: upiId,
      pn: businessName,
      am: upiOrder.total.toFixed(2),
      cu: "INR",
      tn: `${checkoutSettings.payment_note || "Superb Creations order"} ${upiOrder.orderId}`,
    });
    return `upi://pay?${params.toString()}`;
  }, [businessName, checkoutSettings.payment_note, upiId, upiOrder]);

  useEffect(() => {
    if (!upiIntent) {
      setUpiQr("");
      return;
    }
    let mounted = true;
    toDataURL(upiIntent, { width: 240, margin: 2 })
      .then((url) => {
        if (mounted) setUpiQr(url);
      })
      .catch(() => {
        if (mounted) setUpiQr("");
      });
    return () => {
      mounted = false;
    };
  }, [upiIntent]);

  const expiresAt = upiOrder?.paymentExpiresAt
    ? new Date(upiOrder.paymentExpiresAt).getTime()
    : null;
  const remainingMs = expiresAt ? Math.max(0, expiresAt - now) : 0;
  const remainingLabel = `${Math.floor(remainingMs / 60000)
    .toString()
    .padStart(2, "0")}:${Math.floor((remainingMs % 60000) / 1000)
    .toString()
    .padStart(2, "0")}`;

  useEffect(() => {
    if (!expiresAt || expired) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expired, expiresAt]);

  useEffect(() => {
    if (!upiOrder || !expiresAt || expired || remainingMs > 0) return;
    setExpired(true);
    expireOrder({ data: { orderId: upiOrder.orderId } }).catch(() => {
      toast.error("Payment expired. Please generate a new order.");
    });
  }, [expireOrder, expired, expiresAt, remainingMs, upiOrder]);

  const resetUpiOrder = () => {
    setUpiOrder(null);
    setUpiQr("");
    setUtr("");
    setScreenshotUrl("");
    setExpired(false);
    setNow(Date.now());
  };

  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied.`);
  };

  const orderSummaryText = (order: Awaited<ReturnType<typeof saveOrder>>) => {
    const lines = order.items
      .map((i) => `- ${i.name} x ${i.qty} - ${inr(i.price * i.qty)}`)
      .join("\n");
    return `Hi ${checkoutSettings.store_name}! I'd like to place an order:\n\n${lines}\n\nSubtotal: ${inr(order.subtotal)}\nShipping: ${order.shipping === 0 ? "Free" : inr(order.shipping)}\nPackaging: ${inr(order.packaging ?? 0)}\nTax: ${inr(order.tax ?? 0)}\nTotal: ${inr(order.total)}\nEstimated delivery: ${order.estimatedDelivery || shippingQuote?.estimatedDelivery || "To be confirmed"}\n\nOrder ID: ${order.orderId}\nName: ${form.customer_name}\nPhone: ${form.phone}\nAddress: ${form.address}`;
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const result = await validateCoupon.mutateAsync({
        code: couponCode,
        userId: user?.id,
        subtotal,
        shipping,
      });
      setCouponMessage(result.message);
      if (result.ok) {
        setCouponDiscount(Number(result.discount_amount || 0));
        trackAnalyticsEvent({
          eventType: "coupon_applied",
          userId: user?.id,
          metadata: { code: result.code || couponCode.trim().toUpperCase(), discount: Number(result.discount_amount || 0) },
        });
        toast.success(result.message);
      } else {
        setCouponDiscount(0);
        toast.error(result.message);
      }
    } catch (error) {
      setCouponDiscount(0);
      toast.error(error instanceof Error ? error.message : "Coupon could not be applied.");
    }
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
        if (!whatsappEnabled) throw new Error("WhatsApp orders are currently unavailable.");
        const order = await saveOrder("whatsapp");
        trackAnalyticsEvent({
          eventType: "order_placed",
          userId: user?.id,
          metadata: { method: "whatsapp", total: order.total },
        });
        const url = whatsappUrl(checkoutSettings, orderSummaryText(order));
        clear();
        window.open(url, "_blank");
        navigate({ to: "/order-success", search: { method: "whatsapp" } });
        return;
      }

      if (!upiEnabled) throw new Error("UPI payments are currently unavailable.");
      if (!upiOrder) {
        const order = await saveOrder("upi");
        trackAnalyticsEvent({
          eventType: "payment_started",
          userId: user?.id,
          metadata: { method: "upi", total: order.total },
        });
        setUpiOrder(order);
        setNow(Date.now());
        setExpired(false);
        toast.success("Order created. Complete the UPI payment and enter your UTR.");
        setBusy(false);
        return;
      }

      if (expired || remainingMs <= 0) {
        toast.error("Payment expired. Please generate a new order.");
        setBusy(false);
        return;
      }

      if (!utr.trim()) {
        toast.error("Enter the UTR or transaction reference after payment.");
        setBusy(false);
        return;
      }

      await submitUpiPayment({
        data: {
          orderId: upiOrder.orderId,
          payment_utr: utr,
          payment_screenshot_url: screenshotUrl,
        },
      });
      trackAnalyticsEvent({
        eventType: "payment_submitted",
        userId: user?.id,
        metadata: { method: "upi", total: upiOrder.total },
      });
      trackAnalyticsEvent({
        eventType: "order_placed",
        userId: user?.id,
        metadata: { method: "upi", total: upiOrder.total },
      });
      clear();
      navigate({
        to: "/order-success",
        search: {
          method: "upi",
          order: upiOrder.orderId,
          amount: upiOrder.total.toFixed(2),
          status: "under_review",
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not place order.");
      setBusy(false);
    }
  };

  const uploadPaymentScreenshot = async (file: File) => {
    if (!upiOrder) return;
    if (!session) {
      toast.error("Sign in to upload a screenshot, or continue with just the UTR.");
      return;
    }
    setUploadingScreenshot(true);
    try {
      if (!file.type.startsWith("image/")) throw new Error("Please upload an image file.");
      if (file.size > 5 * 1024 * 1024) throw new Error("Image must be 5MB or smaller.");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `upi/${upiOrder.orderId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("payment-screenshots")
        .upload(path, file, { cacheControl: "31536000", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("payment-screenshots").getPublicUrl(path);
      setScreenshotUrl(data.publicUrl);
      toast.success("Screenshot uploaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Screenshot upload failed.");
    } finally {
      setUploadingScreenshot(false);
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

  if (!checkoutEnabled) {
    return (
      <section className="container-boutique py-24 text-center">
        <h1 className="font-display text-4xl">Checkout is paused</h1>
        <p className="mx-auto mt-4 max-w-md text-muted-foreground">
          Online checkout is temporarily unavailable. Please contact support for help with your order.
        </p>
        <Link
          to="/contact"
          className="mt-6 inline-block rounded-full bg-primary px-7 py-3 text-xs uppercase tracking-[0.22em] text-primary-foreground"
        >
          Contact support
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
            {addresses.length > 0 && (
              <select
                className="mt-5 w-full rounded-md border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                defaultValue=""
                onChange={(e) => {
                  const address = addresses.find((a) => a.id === e.target.value);
                  if (!address) return;
                  setForm({
                    customer_name: address.recipient_name,
                    phone: address.phone,
                    email: form.email,
                    address: [
                      address.line1,
                      address.line2,
                      address.city,
                      address.state,
                      address.country,
                      address.pincode,
                    ]
                      .filter(Boolean)
                      .join(", "),
                  });
                  setPincode(address.pincode || "");
                }}
              >
                <option value="">Use saved address</option>
                {addresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.label} - {address.line1}, {address.city}
                  </option>
                ))}
              </select>
            )}
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
              <input
                required
                placeholder="Pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/[^\dA-Za-z -]/g, "").slice(0, 12))}
                className="rounded-md border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              />
              <select
                value={shippingMode}
                onChange={(e) => setShippingMode(e.target.value as "standard" | "express")}
                className="rounded-md border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              >
                <option value="standard">Standard shipping</option>
                <option value="express">Express shipping</option>
              </select>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Estimated delivery: {shippingQuote?.estimatedDelivery || "Calculated after pincode"}.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl">Payment</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {whatsappEnabled && (
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
              )}
              {upiEnabled && (
                <button
                  type="button"
                  onClick={() => setMethod("upi")}
                  className={
                    "flex items-start gap-3 rounded-md border p-4 text-left transition-colors " +
                    (method === "upi" ? "border-primary bg-primary/5" : "border-border")
                  }
                >
                  <Smartphone size={20} className="mt-0.5 shrink-0" />
                  <span>
                    <span className="block text-sm font-medium">Manual UPI payment</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Scan QR or open your UPI app, then enter the UTR.
                    </span>
                  </span>
                </button>
              )}
            </div>
            {method === "upi" && upiOrder && (
              <div className="mt-5 rounded-sm border border-border bg-secondary/30 p-5">
                {expired ? (
                  <div className="rounded-sm border border-destructive/30 bg-background p-4 text-sm">
                    <p className="font-medium text-destructive">Payment Expired</p>
                    <p className="mt-1 text-muted-foreground">
                      This UPI payment window has expired and reserved stock was released.
                    </p>
                    <button
                      type="button"
                      onClick={resetUpiOrder}
                      className="mt-3 rounded-full bg-primary px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground"
                    >
                      Generate New Order
                    </button>
                  </div>
                ) : (
                  <>
                <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
                  <div className="flex h-64 w-64 items-center justify-center rounded-sm bg-background p-3">
                    {upiQr ? (
                      <img src={upiQr} alt="UPI payment QR code" className="h-full w-full" />
                    ) : (
                      <Loader2 size={18} className="animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-3 text-sm">
                    <p className="font-medium">Pay exactly {inr(upiOrder.total)}</p>
                    <p className="text-muted-foreground">Order number: {upiOrder.orderId}</p>
                    <p className="text-muted-foreground">UPI ID: {upiId}</p>
                    <p className="text-muted-foreground">Payment expires in {remainingLabel}</p>
                    <a
                      href={upiIntent}
                      className="inline-flex rounded-full bg-primary px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground"
                    >
                      Pay using any UPI App
                    </a>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => copyText(upiId, "UPI ID")}
                        className="rounded-full border border-border px-3 py-1.5 text-xs"
                      >
                        Copy UPI ID
                      </button>
                      <button
                        type="button"
                        onClick={() => copyText(upiOrder.total.toFixed(2), "Amount")}
                        className="rounded-full border border-border px-3 py-1.5 text-xs"
                      >
                        Copy Amount
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        ["PhonePe", upiIntent],
                        ["Google Pay", upiIntent],
                        ["Paytm", upiIntent],
                        ["BHIM", upiIntent],
                      ].map(([label, href]) => (
                        <a
                          key={label}
                          href={href}
                          className="rounded-full border border-border px-3 py-1.5 text-xs"
                        >
                          Open {label}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-4 rounded-sm bg-background/70 p-3 text-xs leading-relaxed text-muted-foreground">
                  Pay the exact amount shown above, then paste the UTR or transaction reference.
                  We will verify the payment before confirming your order.
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <input
                    value={utr}
                    onChange={(e) => setUtr(e.target.value)}
                    placeholder="UTR / transaction reference"
                    className="rounded-md border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                  />
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-4 py-3 text-sm">
                    {uploadingScreenshot ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Upload size={15} />
                    )}
                    {screenshotUrl ? "Screenshot uploaded" : "Upload screenshot (optional)"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingScreenshot}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadPaymentScreenshot(f);
                      }}
                    />
                  </label>
                </div>
                  </>
                )}
              </div>
            )}
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
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-sm font-medium">Coupon</p>
            <div className="mt-2 flex gap-2">
              <input
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase());
                  setCouponDiscount(0);
                  setCouponMessage("");
                }}
                placeholder="Coupon code"
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                disabled={validateCoupon.isPending || !couponCode.trim()}
                onClick={applyCoupon}
                className="rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.18em] disabled:opacity-50"
              >
                Apply
              </button>
            </div>
            {couponMessage && <p className="mt-2 text-xs text-muted-foreground">{couponMessage}</p>}
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
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery estimate</span>
              <span>{shippingQuote?.estimatedDelivery || "Checking..."}</span>
            </div>
            {packagingCharge > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Packaging</span>
                <span>{inr(packagingCharge)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{inr(tax)}</span>
              </div>
            )}
            {couponDiscount > 0 && (
              <div className="flex justify-between text-primary">
                <span>Discount</span>
                <span>-{inr(couponDiscount)}</span>
              </div>
            )}
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
            {method === "whatsapp"
              ? "Place order on WhatsApp"
              : upiOrder
                ? expired
                  ? "Payment expired"
                  : "Submit UPI reference"
                : `Generate UPI payment for ${inr(total)}`}
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Server will verify stock and calculate the final total before creating your order.
          </p>
        </aside>
      </form>
    </section>
  );
}
