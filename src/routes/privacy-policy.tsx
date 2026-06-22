import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/site/PolicyPage";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Superb Creations" },
      {
        name: "description",
        content: "Privacy practices for Superb Creations orders, support, payments and customer data.",
      },
    ],
  }),
  component: () => (
    <PolicyPage
      eyebrow="Policy"
      title="Privacy Policy"
      updated="June 22, 2026"
      sections={[
        {
          title: "Information we collect",
          body: "We collect the information needed to process orders and support requests, such as name, phone number, email address, delivery address, selected products and payment status. Payment card, UPI and banking details are handled by Razorpay and are not stored by Superb Creations.",
        },
        {
          title: "How we use information",
          body: "We use customer information to create orders, arrange delivery, send order updates, respond to support requests, prevent fraud and meet legal or tax obligations. We do not sell customer data.",
        },
        {
          title: "Service providers",
          body: "We use Supabase for application data, Razorpay for payments, Vercel for hosting and Resend for email notifications. These providers process data only as needed to provide their services.",
        },
        {
          title: "Retention and requests",
          body: "Order records may be retained for business, legal and tax needs. For access, correction or deletion requests, contact support. Placeholder: add the final legal contact email and postal address before launch.",
        },
      ]}
    />
  ),
});
