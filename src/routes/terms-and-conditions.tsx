import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/site/PolicyPage";

export const Route = createFileRoute("/terms-and-conditions")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Superb Creations" },
      {
        name: "description",
        content: "Terms for ordering from Superb Creations.",
      },
    ],
  }),
  component: () => (
    <PolicyPage
      eyebrow="Policy"
      title="Terms & Conditions"
      updated="June 22, 2026"
      sections={[
        {
          title: "Orders",
          body: "Orders are subject to product availability and confirmation. Prices shown on the website are in Indian Rupees. If an item becomes unavailable after order creation, we will contact you to arrange a replacement, refund or cancellation.",
        },
        {
          title: "Payments",
          body: "Online payments are processed through Razorpay. WhatsApp/COD/manual orders are confirmed by the store owner before stock is reserved. Do not share sensitive payment credentials over WhatsApp or email.",
        },
        {
          title: "Product information",
          body: "We try to display product colors, sizes and descriptions accurately, but small variations may occur due to fabric batches, lighting and device screens.",
        },
        {
          title: "Business details",
          body: "Placeholder: add registered business name, GST details if applicable, jurisdiction, legal contact email and complete address before launch.",
        },
      ]}
    />
  ),
});
