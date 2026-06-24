import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { inr } from "@/lib/products";
import { markWhatsappMessageSent } from "@/lib/orders.functions";

export const Route = createFileRoute("/order-success")({
  validateSearch: (search: Record<string, unknown>) => ({
    method:
      search.method === "razorpay" ||
      search.method === "upi" ||
      search.method === "cod" ||
      search.method === "bank_transfer"
        ? search.method
        : "whatsapp",
    order: typeof search.order === "string" ? search.order : undefined,
    amount: typeof search.amount === "string" ? Number(search.amount) : undefined,
    status: typeof search.status === "string" ? search.status : undefined,
  }),
  head: () => ({ meta: [{ title: "Order placed — Superb Creations" }] }),
  component: OrderSuccess,
});

function OrderSuccess() {
  const { method, order, amount, status } = Route.useSearch();
  const markSent = useServerFn(markWhatsappMessageSent);
  const [claimingSent, setClaimingSent] = useState(false);

  const handleWhatsappSent = async () => {
    if (!order) return;
    setClaimingSent(true);
    try {
      await markSent({ data: { orderId: order } });
      toast.success("Thanks. Your order is waiting for admin confirmation.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update WhatsApp order status.");
    } finally {
      setClaimingSent(false);
    }
  };

  return (
    <section className="container-boutique flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <CheckCircle2 size={56} className="text-primary" />
      <h1 className="mt-6 font-display text-4xl md:text-5xl">Thank you!</h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        {method === "razorpay"
          ? "Your payment was successful and your order is confirmed. We'll be in touch shortly with delivery details."
          : method === "upi"
            ? "Your UPI payment reference has been submitted. We'll verify the payment and confirm your order shortly."
            : method === "cod"
              ? "Your COD order is pending store confirmation. We'll confirm availability before dispatch."
              : method === "bank_transfer"
                ? "Your bank transfer reference has been submitted. We'll verify the payment and confirm your order shortly."
                : "Your order draft is ready. Please send the WhatsApp message to confirm — the order is not confirmed until we receive and verify it."}
      </p>
      {method === "upi" && (
        <div className="mt-6 rounded-sm border border-border bg-secondary/30 p-4 text-sm">
          {order && <p>Order number: {order}</p>}
          {typeof amount === "number" && !Number.isNaN(amount) && <p>Amount: {inr(amount)}</p>}
          <p>Payment status: {status === "under_review" ? "Under Review" : "Payment Submitted"}</p>
          <p className="mt-2 text-muted-foreground">
            Your invoice will be available after payment approval.
          </p>
        </div>
      )}
      {method === "whatsapp" && order && (
        <div className="mt-6 rounded-sm border border-border bg-secondary/30 p-4 text-sm">
          <p>Order draft: {order.slice(0, 8).toUpperCase()}</p>
          <p className="mt-2 text-muted-foreground">
            Status: {status === "awaiting_customer_message" ? "Awaiting WhatsApp message" : "Pending WhatsApp confirmation"}
          </p>
          <button
            type="button"
            disabled={claimingSent}
            onClick={handleWhatsappSent}
            className="mt-4 rounded-full border border-border px-5 py-2 text-xs uppercase tracking-[0.18em] disabled:opacity-60"
          >
            {claimingSent ? "Updating..." : "I have sent the WhatsApp message"}
          </button>
        </div>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          to="/shop"
          className="rounded-full bg-primary px-7 py-3 text-xs uppercase tracking-[0.22em] text-primary-foreground"
        >
          Continue shopping
        </Link>
        <Link
          to="/"
          className="rounded-full border border-border px-7 py-3 text-xs uppercase tracking-[0.22em]"
        >
          Back home
        </Link>
      </div>
    </section>
  );
}
