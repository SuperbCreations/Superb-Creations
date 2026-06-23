import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/site/PolicyPage";

export const Route = createFileRoute("/shipping-policy")({
  head: () => ({
    meta: [
      { title: "Shipping Policy — Superb Creations" },
      {
        name: "description",
        content: "Shipping timelines and delivery policy for Superb Creations orders.",
      },
    ],
  }),
  component: () => (
    <PolicyPage
      eyebrow="Policy"
      title="Shipping Policy"
      updated="June 22, 2026"
      settingKey="shipping_policy"
      sections={[
        {
          title: "Delivery area",
          body: "We currently ship across India. Placeholder: add any restricted pin codes, courier partners and international shipping policy before launch.",
        },
        {
          title: "Processing time",
          body: "Orders are usually processed after payment or manual confirmation. Placeholder: add exact dispatch timelines for ready-to-ship and made-to-order products.",
        },
        {
          title: "Shipping charges",
          body: "Free shipping is currently shown for orders above ₹2,500. Orders below that threshold may include a shipping charge shown at checkout.",
        },
        {
          title: "Delays",
          body: "Delivery timelines can be affected by courier delays, weather, holidays or address issues. We will help track delayed shipments when contacted.",
        },
      ]}
    />
  ),
});
