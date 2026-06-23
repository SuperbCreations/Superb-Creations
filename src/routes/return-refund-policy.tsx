import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/site/PolicyPage";

export const Route = createFileRoute("/return-refund-policy")({
  head: () => ({
    meta: [
      { title: "Return & Refund Policy — Superb Creations" },
      {
        name: "description",
        content: "Return and refund policy for Superb Creations orders.",
      },
    ],
  }),
  component: () => (
    <PolicyPage
      eyebrow="Policy"
      title="Return & Refund Policy"
      updated="June 22, 2026"
      settingKey="return_refund_policy"
      sections={[
        {
          title: "Eligibility",
          body: "Placeholder: add exact return window, eligible categories and exclusions before launch. Cosmetics, personalized items and worn/washed garments are commonly excluded unless defective.",
        },
        {
          title: "Damaged or incorrect items",
          body: "If you receive a damaged or incorrect item, contact support with your order ID and clear photos as soon as possible. We will review and offer a replacement, store credit or refund where applicable.",
        },
        {
          title: "Refunds",
          body: "Approved refunds are processed to the original payment method where possible. Razorpay/bank timelines may vary after we initiate the refund.",
        },
        {
          title: "Return shipping",
          body: "Placeholder: specify who pays return shipping, pickup availability and packaging requirements before launch.",
        },
      ]}
    />
  ),
});
