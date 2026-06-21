import { createServerFn } from "@tanstack/react-start";

/**
 * Sends an order notification to the admin AND a confirmation email to the customer.
 *
 * 🟡 EMAIL WIRING IS PENDING — waiting on email domain (e.g. superbcreations.in) verification.
 *
 * Once the domain is set up in Cloud → Emails:
 * 1. The transactional email infra needs to be scaffolded (one tool call from the AI side).
 * 2. Replace the console.log below with a call to the queue-send route, e.g.
 *
 *    await fetch(`${baseUrl}/lovable/email/transactional/send`, {
 *      method: "POST",
 *      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
 *      body: JSON.stringify({
 *        templateName: "order-admin",
 *        recipientEmail: "superbcreations55@gmail.com",
 *        idempotencyKey: `order-admin-${orderId}`,
 *        templateData: { ... },
 *      }),
 *    });
 *
 * For now this function just logs the payload server-side — orders still save fine.
 */
export const sendOrderNotifications = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      orderId: string;
      customerName: string;
      customerEmail: string | null;
      customerPhone: string;
      address: string;
      items: Array<{
        name: string;
        qty: number;
        price: number;
        variant_label?: string | null;
      }>;
      total: number;
      paymentMethod: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    // eslint-disable-next-line no-console
    console.log("[order notification — email pending domain setup]", {
      to_admin: "superbcreations55@gmail.com",
      to_customer: data.customerEmail,
      order: data,
    });
    return { queued: true, emailEnabled: false };
  });