import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/site/PolicyPage";

export const Route = createFileRoute("/support-policy")({
  head: () => ({
    meta: [
      { title: "Contact & Support Policy — Superb Creations" },
      {
        name: "description",
        content: "Support channels and response expectations for Superb Creations.",
      },
    ],
  }),
  component: () => (
    <PolicyPage
      eyebrow="Policy"
      title="Contact & Support Policy"
      updated="June 22, 2026"
      sections={[
        {
          title: "Support channels",
          body: "Primary support is available on WhatsApp at +91 70062 02496 and by email at hello@superbcreations.in. Placeholder: confirm final support email before launch.",
        },
        {
          title: "Response times",
          body: "Typical support hours are Monday to Saturday, 10am to 7pm India time. Response times may be slower on holidays or during high-volume periods.",
        },
        {
          title: "Order help",
          body: "Please include your order ID, phone number and the issue you need help with. Do not send card, UPI PIN, OTP or banking passwords over support channels.",
        },
      ]}
    />
  ),
});
