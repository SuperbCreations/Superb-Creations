import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Loader2, LogIn, Smartphone, Upload, CreditCard, Banknote, Landmark } from "lucide-react";
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
import { getShippingOptions } from "@/lib/shipping-settings";
import {
  calculateShippingQuote,
  createCheckoutOrder,
  expireUpiOrder,
  submitUpiPaymentReference,
} from "@/lib/orders.functions";
import { createRazorpayOrder, markRazorpayPaymentFailed, verifyRazorpayPayment } from "@/lib/razorpay.functions";
import { usePaymentMethods, type PaymentMethod, type PaymentMethodKey } from "@/lib/payments";
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
  paymentFee?: number;
  paymentDetails?: Record<string, unknown>;
};

type CheckoutMethod = "whatsapp" | PaymentMethodKey;

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function Checkout() {
  const navigate = useNavigate();
  const { items, subtotal, clear } = useCart();
  const { user, session } = useAuth();
  const { settings } = useBusinessSettings();
  const {
    data: paymentMethods = [],
    isLoading: paymentMethodsLoading,
    error: paymentMethodsError,
  } = usePaymentMethods();
  const { data: addresses = [] } = useCustomerAddresses(user?.id);
  const validateCoupon = useValidateCoupon();
  const [form, setForm] = useState({ customer_name: "", phone: "", email: "", address: "" });
  const [method, setMethod] = useState<CheckoutMethod>("upi");
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
  const [autofilledForUser, setAutofilledForUser] = useState<string | null>(null);

  const createOrder = useServerFn(createCheckoutOrder);
  const quoteShipping = useServerFn(calculateShippingQuote);
  const submitUpiPayment = useServerFn(submitUpiPaymentReference);
  const expireOrder = useServerFn(expireUpiOrder);
  const createRazorpay = useServerFn(createRazorpayOrder);
  const verifyRazorpay = useServerFn(verifyRazorpayPayment);
  const failRazorpay = useServerFn(markRazorpayPaymentFailed);

  const checkoutSettings = settings;
  const checkoutEnabled = settingBool(checkoutSettings, "enable_checkout");
  const whatsappEnabled = settingBool(checkoutSettings, "enable_whatsapp");
  const codAvailable = settingBool(checkoutSettings, "cod_available");
  const shippingOptions = useMemo(() => getShippingOptions(checkoutSettings), [checkoutSettings]);
  const shippingUnavailable = shippingOptions.length === 0;
  const taxPercentage = settingNumber(checkoutSettings, "tax_percentage");
  const shipping = shippingQuote?.shipping ?? 0;
  const packagingCharge = shippingQuote?.packaging ?? 0;
  const tax = Math.round(((subtotal + shipping + packagingCharge) * taxPercentage) / 100);
  const availablePaymentMethods = useMemo(
    () =>
      paymentMethods.filter(
        (paymentMethod) =>
          paymentMethod.enabled &&
          (paymentMethod.method_key !== "cod" || codAvailable),
      ),
    [codAvailable, paymentMethods],
  );
  const selectedPaymentMethod = availablePaymentMethods.find((m) => m.method_key === method);
  const paymentFee = method === "whatsapp" ? 0 : Number(selectedPaymentMethod?.extra_fee || 0);
  const total = Math.max(0, subtotal + shipping + packagingCharge + tax + paymentFee - couponDiscount);
  const disabledReason = (m: PaymentMethod) => {
    if (subtotal < Number(m.min_order_amount || 0)) return `Minimum order ${inr(Number(m.min_order_amount || 0))}`;
    if (m.max_order_amount != null && subtotal > Number(m.max_order_amount)) return `Available up to ${inr(Number(m.max_order_amount))}`;
    return "";
  };
  const firstSelectablePaymentMethod = useMemo(() => {
    const isAllowedForSubtotal = (paymentMethod: PaymentMethod) => {
      if (subtotal < Number(paymentMethod.min_order_amount || 0)) return false;
      if (paymentMethod.max_order_amount != null && subtotal > Number(paymentMethod.max_order_amount)) return false;
      return true;
    };
    return (
      availablePaymentMethods.find((paymentMethod) => paymentMethod.recommended && isAllowedForSubtotal(paymentMethod)) ??
      availablePaymentMethods.find(isAllowedForSubtotal) ??
      availablePaymentMethods[0]
    );
  }, [availablePaymentMethods, subtotal]);
  const paymentIcon = (key: string) => {
    if (key === "razorpay") return <CreditCard size={20} className="mt-0.5 shrink-0" />;
    if (key === "cod") return <Banknote size={20} className="mt-0.5 shrink-0" />;
    if (key === "bank_transfer") return <Landmark size={20} className="mt-0.5 shrink-0" />;
    return <Smartphone size={20} className="mt-0.5 shrink-0" />;
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const applyAddress = (address: (typeof addresses)[number]) => {
    setForm((current) => ({
      customer_name: address.recipient_name || current.customer_name,
      phone: address.phone || current.phone,
      email: current.email,
      address:
        [
          address.line1,
          address.line2,
          address.city,
          address.state,
          address.country,
          address.pincode,
        ]
          .filter(Boolean)
          .join(", ") || current.address,
    }));
    setPincode(address.pincode || "");
  };

  const saveOrder = async (paymentMethod: CheckoutMethod) =>
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
    if (paymentMethodsLoading) return;
    if (method === "whatsapp" && whatsappEnabled) return;

    const methodIsVisible = availablePaymentMethods.some((m) => m.method_key === method);
    if (methodIsVisible) return;

    if (firstSelectablePaymentMethod) {
      setMethod(firstSelectablePaymentMethod.method_key);
      return;
    }

    if (whatsappEnabled) {
      setMethod("whatsapp");
    }
  }, [availablePaymentMethods, firstSelectablePaymentMethod, method, paymentMethodsLoading, whatsappEnabled]);

  useEffect(() => {
    if (upiOrder && upiOrder.paymentMethod !== method) {
      setUpiOrder(null);
      setUpiQr("");
      setUtr("");
      setScreenshotUrl("");
      setExpired(false);
      setNow(Date.now());
    }
  }, [method, upiOrder]);

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
    if (shippingOptions.length === 0) return;
    if (!shippingOptions.some((option) => option.key === shippingMode)) {
      setShippingMode(shippingOptions[0].key);
    }
  }, [shippingMode, shippingOptions]);

  useEffect(() => {
    if (!user || autofilledForUser === user.id) return;
    const metadata = (user.user_metadata || {}) as Record<string, string | undefined>;
    const defaultAddress =
      addresses.find((address) => address.is_default) ??
      addresses.find((address) => address.is_shipping) ??
      addresses[0];
    const addressText = defaultAddress
      ? [
          defaultAddress.line1,
          defaultAddress.line2,
          defaultAddress.city,
          defaultAddress.state,
          defaultAddress.country,
          defaultAddress.pincode,
        ]
          .filter(Boolean)
          .join(", ")
      : "";

    setForm((current) => ({
      customer_name:
        current.customer_name ||
        metadata.full_name ||
        metadata.name ||
        user.email?.split("@")[0] ||
        "",
      phone: current.phone || defaultAddress?.phone || "",
      email: current.email || user.email || "",
      address: current.address || addressText,
    }));
    if (defaultAddress?.pincode) {
      setPincode((current) => current || defaultAddress.pincode);
    }
    setAutofilledForUser(user.id);
  }, [addresses, autofilledForUser, user]);

  useEffect(() => {
    if (items.length === 0) {
      setShippingQuote(null);
      return;
    }
    if (shippingUnavailable) {
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
      .catch((error) => {
        if (!cancelled) {
          setShippingQuote(null);
          toast.error(error instanceof Error ? error.message : "Shipping could not be calculated.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [items, pincode, quoteShipping, shippingMode, shippingUnavailable, subtotal]);

  const businessName = checkoutSettings.business_name || "Superb Creations";
  const activePaymentDetails = (upiOrder?.paymentDetails ?? selectedPaymentMethod?.public_details ?? {}) as Record<string, unknown>;
  const upiId = String(activePaymentDetails.upi_id || "");
  const upiPayeeName = String(activePaymentDetails.payee_name || activePaymentDetails.business_name || businessName);
  const bankDetails = activePaymentDetails;
  const upiIntent = useMemo(() => {
    if (!upiOrder || !upiId) return "";
    const params = new URLSearchParams({
      pa: upiId,
      pn: upiPayeeName,
      am: upiOrder.total.toFixed(2),
      cu: "INR",
      tn: `${checkoutSettings.payment_note || "Superb Creations order"} ${upiOrder.orderId}`,
    });
    return `upi://pay?${params.toString()}`;
  }, [checkoutSettings.payment_note, upiId, upiOrder, upiPayeeName]);

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

  const loadRazorpayScript = () =>
    new Promise<void>((resolve, reject) => {
      if (window.Razorpay) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load Razorpay checkout."));
      document.body.appendChild(script);
    });

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

  const selectedPaymentLabel =
    method === "whatsapp"
      ? "WhatsApp order"
      : selectedPaymentMethod?.display_name || "selected payment method";
  const paymentSelectionUnavailable =
    !paymentMethodsLoading && !whatsappEnabled && availablePaymentMethods.length === 0;
  const submitLabel =
    method === "whatsapp"
      ? "Place order on WhatsApp"
      : method === "cod"
        ? `Place COD order for ${inr(total)}`
        : method === "razorpay"
          ? `Pay online ${inr(total)}`
          : upiOrder
            ? expired
              ? "Payment expired"
              : "Submit payment reference"
            : `Generate ${selectedPaymentLabel} for ${inr(total)}`;

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
    if (shippingUnavailable) {
      toast.error("No shipping method is currently available. Please contact support before placing your order.");
      return;
    }

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

      if (!selectedPaymentMethod && method !== "whatsapp") {
        throw new Error("That payment option is not available right now. Please choose another method.");
      }
      if (selectedPaymentMethod && subtotal < Number(selectedPaymentMethod.min_order_amount || 0)) {
        throw new Error(`${selectedPaymentMethod.display_name} requires a higher order value.`);
      }
      if (selectedPaymentMethod?.max_order_amount != null && subtotal > Number(selectedPaymentMethod.max_order_amount)) {
        throw new Error(`${selectedPaymentMethod.display_name} is not available for this order value.`);
      }
      if (method === "upi" && !String(selectedPaymentMethod?.public_details?.upi_id || "").trim()) {
        throw new Error("UPI payment details are not configured yet. Please choose another payment method.");
      }

      if (method === "cod") {
        const order = await saveOrder("cod");
        trackAnalyticsEvent({
          eventType: "order_placed",
          userId: user?.id,
          metadata: { method: "cod", total: order.total },
        });
        clear();
        navigate({ to: "/order-success", search: { method: "cod", order: order.orderId, status: "cod_pending" } });
        return;
      }

      if (method === "razorpay") {
        const order = await saveOrder("razorpay");
        const razorpayOrder = await createRazorpay({ data: { orderId: order.orderId } });
        if (!razorpayOrder.configured) {
          throw new Error("Razorpay is not configured yet. Please choose another payment method.");
        }
        await loadRazorpayScript();
        await new Promise<void>((resolve, reject) => {
          const RazorpayCheckout = window.Razorpay;
          if (!RazorpayCheckout) {
            reject(new Error("Razorpay checkout did not load."));
            return;
          }
          const checkout = new RazorpayCheckout({
            key: razorpayOrder.keyId,
            amount: razorpayOrder.amount,
            currency: "INR",
            name: businessName,
            description: `Order ${order.orderId}`,
            order_id: razorpayOrder.razorpayOrderId,
            handler: async (response: any) => {
              const result = await verifyRazorpay({
                data: {
                  orderId: order.orderId,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                },
              });
              if (!result.ok) {
                reject(new Error("Payment verification failed."));
                return;
              }
              resolve();
            },
            prefill: {
              name: form.customer_name,
              email: form.email || undefined,
              contact: form.phone,
            },
            modal: {
              ondismiss: () => reject(new Error("Payment was cancelled.")),
            },
          });
          checkout.open();
        }).catch(async (error) => {
          await failRazorpay({
            data: {
              orderId: order.orderId,
              razorpay_order_id: razorpayOrder.razorpayOrderId,
              reason: error instanceof Error ? error.message : "Razorpay payment failed",
            },
          });
          throw error;
        });
        trackAnalyticsEvent({
          eventType: "order_placed",
          userId: user?.id,
          metadata: { method: "razorpay", total: order.total },
        });
        clear();
        navigate({ to: "/order-success", search: { method: "razorpay", order: order.orderId, status: "paid" } });
        return;
      }

      if (!["upi", "bank_transfer"].includes(method)) throw new Error("Selected payment method is unavailable.");
      if (!upiOrder) {
        const order = await saveOrder(method);
        trackAnalyticsEvent({
          eventType: "payment_started",
          userId: user?.id,
          metadata: { method, total: order.total },
        });
        setUpiOrder(order);
        setNow(Date.now());
        setExpired(false);
        toast.success("Order created. Complete the payment and enter your reference.");
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
          method: method === "bank_transfer" ? "bank_transfer" : "upi",
          payment_utr: utr,
          payment_screenshot_url: screenshotUrl,
        },
      });
      trackAnalyticsEvent({
        eventType: "payment_submitted",
        userId: user?.id,
        metadata: { method, total: upiOrder.total },
      });
      trackAnalyticsEvent({
        eventType: "order_placed",
        userId: user?.id,
        metadata: { method, total: upiOrder.total },
      });
      clear();
      navigate({
        to: "/order-success",
        search: {
          method,
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
      const path = `${method}/${upiOrder.orderId}/${crypto.randomUUID()}.${ext}`;
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
                  applyAddress(address);
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
              {shippingOptions.length > 0 ? (
                <select
                  value={shippingMode}
                  onChange={(e) => setShippingMode(e.target.value as "standard" | "express")}
                  className="rounded-md border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                >
                  {shippingOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="rounded-md border border-destructive/30 bg-background px-4 py-3 text-sm text-destructive sm:col-span-2">
                  No shipping method is currently available. Please contact support before placing your order.
                </p>
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Estimated delivery: {shippingQuote?.estimatedDelivery || shippingOptions.find((option) => option.key === shippingMode)?.estimate || "Calculated after pincode"}.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl">Payment</h2>
            {paymentMethodsLoading && (
              <p className="mt-3 text-xs text-muted-foreground">Loading payment methods...</p>
            )}
            {paymentMethodsError && (
              <p className="mt-3 text-xs text-destructive">
                Payment methods could not be loaded. You can still place a WhatsApp order if it is available.
              </p>
            )}
            {paymentSelectionUnavailable && (
              <p className="mt-3 text-xs text-destructive">
                No payment methods are currently available. Please contact support.
              </p>
            )}
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
              {availablePaymentMethods.map((paymentMethod) => {
                const reason = disabledReason(paymentMethod);
                const disabled = Boolean(reason);
                return (
                <button
                  key={paymentMethod.method_key}
                  type="button"
                  disabled={disabled}
                  onClick={() => setMethod(paymentMethod.method_key as typeof method)}
                  className={
                    "flex items-start gap-3 rounded-md border p-4 text-left transition-colors disabled:opacity-60 " +
                    (method === paymentMethod.method_key ? "border-primary bg-primary/5" : "border-border")
                  }
                >
                  {paymentIcon(paymentMethod.method_key)}
                  <span>
                    <span className="block text-sm font-medium">
                      {paymentMethod.display_name}
                      {paymentMethod.recommended && <span className="ml-2 text-xs text-primary">Recommended</span>}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {paymentMethod.description}
                    </span>
                    {paymentMethod.extra_fee > 0 && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Fee: {inr(Number(paymentMethod.extra_fee))}
                      </span>
                    )}
                    {paymentMethod.verification_time && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {paymentMethod.verification_time}
                      </span>
                    )}
                    {reason && <span className="mt-1 block text-xs text-destructive">{reason}</span>}
                  </span>
                </button>
                );
              })}
            </div>
            {selectedPaymentMethod?.instructions && (
              <p className="mt-3 rounded-sm bg-secondary/40 p-3 text-xs leading-5 text-muted-foreground">
                {selectedPaymentMethod.instructions}
              </p>
            )}
            {["upi", "bank_transfer"].includes(method) && upiOrder && (
              <div className="mt-5 rounded-sm border border-border bg-secondary/30 p-5">
                {expired ? (
                  <div className="rounded-sm border border-destructive/30 bg-background p-4 text-sm">
                    <p className="font-medium text-destructive">Payment Expired</p>
                    <p className="mt-1 text-muted-foreground">
                      This payment window has expired and reserved stock was released.
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
                  {method === "upi" && (
                    <div className="flex h-64 w-64 items-center justify-center rounded-sm bg-background p-3">
                      {upiQr ? (
                        <img src={upiQr} alt="UPI payment QR code" className="h-full w-full" />
                      ) : (
                        <Loader2 size={18} className="animate-spin text-muted-foreground" />
                      )}
                    </div>
                  )}
                  {method === "bank_transfer" && (
                    <div className="rounded-sm bg-background p-4 text-sm">
                      <p className="font-medium">Bank details</p>
                      {[
                        ["Account name", bankDetails.account_name],
                        ["Account number", bankDetails.account_number],
                        ["IFSC", bankDetails.ifsc],
                        ["Bank", bankDetails.bank_name],
                        ["Branch", bankDetails.branch],
                      ].filter(([, value]) => value).map(([label, value]) => (
                        <p key={label} className="mt-2 text-muted-foreground">
                          <span className="text-foreground">{label}:</span> {String(value)}
                        </p>
                      ))}
                    </div>
                  )}
                  <div className="space-y-3 text-sm">
                    <p className="font-medium">Pay exactly {inr(upiOrder.total)}</p>
                    <p className="text-muted-foreground">Order number: {upiOrder.orderId}</p>
                    {method === "upi" && <p className="text-muted-foreground">Payee: {upiPayeeName}</p>}
                    {method === "upi" && <p className="text-muted-foreground">UPI ID: {upiId}</p>}
                    <p className="text-muted-foreground">Payment expires in {remainingLabel}</p>
                    {method === "upi" && (
                      <a
                        href={upiIntent}
                        className="inline-flex rounded-full bg-primary px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground"
                      >
                        Pay using any UPI App
                      </a>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {method === "upi" && (
                        <button
                          type="button"
                          onClick={() => copyText(upiId, "UPI ID")}
                          className="rounded-full border border-border px-3 py-1.5 text-xs"
                        >
                          Copy UPI ID
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => copyText(upiOrder.total.toFixed(2), "Amount")}
                        className="rounded-full border border-border px-3 py-1.5 text-xs"
                      >
                        Copy Amount
                      </button>
                    </div>
                    {method === "upi" && <div className="flex flex-wrap gap-2">
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
                    </div>}
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
            {paymentFee > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment fee</span>
                <span>{inr(paymentFee)}</span>
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
            disabled={busy || paymentMethodsLoading || paymentSelectionUnavailable || shippingUnavailable}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-xs uppercase tracking-[0.22em] text-primary-foreground disabled:opacity-60"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {submitLabel}
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Server will verify stock and calculate the final total before creating your order.
          </p>
        </aside>
      </form>
    </section>
  );
}
