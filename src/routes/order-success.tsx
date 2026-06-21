import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/order-success")({
  validateSearch: (search: Record<string, unknown>) => ({
    method: search.method === "razorpay" ? "razorpay" : "whatsapp",
  }),
  head: () => ({ meta: [{ title: "Order placed — Superb Creations" }] }),
  component: OrderSuccess,
});

function OrderSuccess() {
  const { method } = Route.useSearch();

  return (
    <section className="container-boutique flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <CheckCircle2 size={56} className="text-primary" />
      <h1 className="mt-6 font-display text-4xl md:text-5xl">Thank you!</h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        {method === "razorpay"
          ? "Your payment was successful and your order is confirmed. We'll be in touch shortly with delivery details."
          : "Your order details have opened in WhatsApp. Send us the message to confirm — we'll reply with availability and payment details."}
      </p>
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
