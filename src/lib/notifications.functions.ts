import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Email notifications via Resend (https://resend.com).
 *
 * Required env vars (set via Lovable Cloud secrets — never hardcode):
 *   RESEND_API_KEY      — API key from Resend dashboard
 *   RESEND_FROM         — (optional) "Name <email@yourdomain>", defaults to
 *                         Resend's shared sandbox sender `onboarding@resend.dev`.
 *                         The shared sender works without verifying a domain
 *                         but Resend restricts it to the account owner's email
 *                         until you verify your own domain.
 *   ADMIN_EMAIL         — (optional) recipient for admin order notifications,
 *                         defaults to superbcreations55@gmail.com.
 */

const FROM_DEFAULT = "Superb Creations <onboarding@resend.dev>";
const ADMIN_DEFAULT = "superbcreations55@gmail.com";

type ItemLine = {
  name: string;
  qty: number;
  price: number;
  variant_label?: string | null;
};

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

async function sendResend(args: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[resend] RESEND_API_KEY not set — skipping email send");
    return { ok: false as const, skipped: true as const };
  }
  const from = process.env.RESEND_FROM || FROM_DEFAULT;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(args.to) ? args.to : [args.to],
      subject: args.subject,
      html: args.html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[resend] send failed", res.status, text);
    return { ok: false as const, error: text };
  }
  const json = (await res.json()) as { id?: string };
  return { ok: true as const, id: json.id };
}

function itemRows(items: ItemLine[]) {
  return items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">
          <div style="font-weight:600;color:#111">${escape(i.name)}</div>
          ${i.variant_label ? `<div style="font-size:12px;color:#666">${escape(i.variant_label)}</div>` : ""}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${i.qty}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${inr(i.qty * i.price)}</td>
      </tr>`,
    )
    .join("");
}

function escape(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f5f1;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f5f1;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">
        <tr><td style="padding:24px 28px;border-bottom:1px solid #eee">
          <div style="font-family:Georgia,serif;font-size:22px;font-weight:600;letter-spacing:.5px">Superb Creations</div>
          <div style="font-size:12px;color:#888;margin-top:2px">${escape(title)}</div>
        </td></tr>
        <tr><td style="padding:24px 28px">${body}</td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #eee;font-size:12px;color:#888">
          Need help? Reply to this email or WhatsApp +91 70062 02496.
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`;
}

const notificationSchema = z.object({
  orderId: z.string().uuid(),
  customerName: z.string(),
  customerEmail: z.string().email().nullable(),
  customerPhone: z.string(),
  address: z.string(),
  items: z.array(
    z.object({
      name: z.string(),
      qty: z.number().int().positive(),
      price: z.number().int().nonnegative(),
      variant_label: z.string().nullable().optional(),
    }),
  ),
  total: z.number().int().nonnegative(),
  paymentMethod: z.string(),
});

export const sendOrderNotifications = createServerFn({ method: "POST" })
  .inputValidator((data) => notificationSchema.parse(data))
  .handler(async ({ data }) => {
    const adminEmail = process.env.ADMIN_EMAIL || ADMIN_DEFAULT;
    const rows = itemRows(data.items);

    const summary = `
      <p style="margin:0 0 12px;font-size:14px;color:#444">
        Order <strong>#${data.orderId.slice(0, 8).toUpperCase()}</strong>
        · Payment: <strong>${escape(data.paymentMethod)}</strong>
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:12px 0 8px">
        <thead><tr style="background:#fafaf7">
          <th align="left" style="padding:8px 12px;font-size:12px;color:#555;border-bottom:1px solid #eee">Item</th>
          <th align="center" style="padding:8px 12px;font-size:12px;color:#555;border-bottom:1px solid #eee">Qty</th>
          <th align="right" style="padding:8px 12px;font-size:12px;color:#555;border-bottom:1px solid #eee">Amount</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td colspan="2" style="padding:12px;text-align:right;font-weight:600">Total</td>
          <td style="padding:12px;text-align:right;font-weight:700;font-size:16px">${inr(data.total)}</td>
        </tr></tfoot>
      </table>`;

    const adminBody = `
      ${summary}
      <h3 style="margin:18px 0 6px;font-size:14px">Customer</h3>
      <div style="font-size:14px;line-height:1.6">
        <div><strong>${escape(data.customerName)}</strong></div>
        <div>${escape(data.customerPhone)}</div>
        ${data.customerEmail ? `<div>${escape(data.customerEmail)}</div>` : ""}
        <div style="color:#555;white-space:pre-wrap;margin-top:6px">${escape(data.address)}</div>
      </div>`;

    const customerBody = `
      <p style="font-size:16px;margin:0 0 12px">Hi ${escape(data.customerName.split(" ")[0] || "there")},</p>
      <p style="font-size:14px;line-height:1.6;color:#444;margin:0 0 16px">
        Thank you for your order! We've received it and will WhatsApp you shortly to confirm shipping details.
      </p>
      ${summary}
      <p style="font-size:13px;color:#666;margin:16px 0 0">Shipping to:<br/><span style="white-space:pre-wrap">${escape(data.address)}</span></p>`;

    const [adminRes, customerRes] = await Promise.allSettled([
      sendResend({
        to: adminEmail,
        subject: `New order — ${data.customerName} (${inr(data.total)})`,
        html: shell("New order received", adminBody),
      }),
      data.customerEmail
        ? sendResend({
            to: data.customerEmail,
            subject: `Order confirmed — Superb Creations`,
            html: shell("Order confirmation", customerBody),
          })
        : Promise.resolve({ ok: false as const, skipped: true as const }),
    ]);

    return {
      admin: adminRes.status === "fulfilled" ? adminRes.value : { ok: false, error: String(adminRes.reason) },
      customer: customerRes.status === "fulfilled" ? customerRes.value : { ok: false, error: String(customerRes.reason) },
      emailEnabled: !!process.env.RESEND_API_KEY,
    };
  });

const shippedSchema = z.object({
  orderId: z.string().uuid(),
  customerName: z.string(),
  customerEmail: z.string().email(),
  trackingInfo: z.string().optional(),
});

export const sendOrderShippedEmail = createServerFn({ method: "POST" })
  .inputValidator((data) => shippedSchema.parse(data))
  .handler(async ({ data }) => {
    const body = `
      <p style="font-size:16px;margin:0 0 12px">Hi ${escape(data.customerName.split(" ")[0] || "there")},</p>
      <p style="font-size:14px;line-height:1.6;color:#444">
        Great news — your order <strong>#${data.orderId.slice(0, 8).toUpperCase()}</strong> has shipped!
      </p>
      ${data.trackingInfo ? `<p style="font-size:14px;color:#444"><strong>Tracking:</strong> ${escape(data.trackingInfo)}</p>` : ""}
      <p style="font-size:13px;color:#666;margin-top:16px">We'll be in touch on WhatsApp if anything else is needed.</p>`;
    return sendResend({
      to: data.customerEmail,
      subject: "Your order is on the way ✨",
      html: shell("Order shipped", body),
    });
  });
