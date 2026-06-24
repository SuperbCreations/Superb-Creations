import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Email notifications via Brevo.
 *
 * Brevo configuration is stored in owner-only Business Settings. The API key
 * is read only from server code using the Supabase service role and is redacted
 * from public settings reads.
 */

const ADMIN_DEFAULT = "superbcreations55@gmail.com";

type ItemLine = {
  name: string;
  qty: number;
  price: number;
  variant_label?: string | null;
};

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

type EmailSettings = {
  storeName: string;
  contactEmail: string;
  supportEmail: string;
  businessEmail: string;
  phoneNumber: string;
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  companyAddress: string;
  emailLogoUrl: string;
  emailFooter: string;
  emailPrimaryColor: string;
  emailSecondaryColor: string;
  enableEmailSending: boolean;
  brevoApiKey: string;
  brevoContactsEnabled: boolean;
  instagramUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
};

async function loadEmailSettings(): Promise<EmailSettings> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("business_settings")
      .select("key,value")
      .in("key", [
        "store_name",
        "contact_email",
        "support_email",
        "business_email",
        "phone_number",
        "email_sender_name",
        "email_sender_email",
        "email_reply_to",
        "email_company_address",
        "email_logo_url",
        "email_footer",
        "email_primary_color",
        "email_secondary_color",
        "enable_email_sending",
        "brevo_api_key",
        "brevo_contacts_enabled",
        "instagram_url",
        "facebook_url",
        "youtube_url",
      ]);
    if (error) throw error;
    const rows = new Map<string, string>((data ?? []).map((row: any) => [row.key, row.value]));
    return {
      storeName: rows.get("store_name") || "Superb Creations",
      contactEmail: rows.get("contact_email") || ADMIN_DEFAULT,
      supportEmail: rows.get("support_email") || rows.get("contact_email") || ADMIN_DEFAULT,
      businessEmail: rows.get("business_email") || rows.get("contact_email") || ADMIN_DEFAULT,
      phoneNumber: rows.get("phone_number") || "+91 70062 02496",
      senderName: rows.get("email_sender_name") || rows.get("store_name") || "Superb Creations",
      senderEmail:
        rows.get("email_sender_email") ||
        rows.get("business_email") ||
        rows.get("contact_email") ||
        "",
      replyToEmail: rows.get("email_reply_to") || rows.get("support_email") || rows.get("contact_email") || "",
      companyAddress: rows.get("email_company_address") || rows.get("address") || "",
      emailLogoUrl: rows.get("email_logo_url") || "",
      emailFooter: rows.get("email_footer") || "Thank you for shopping with Superb Creations.",
      emailPrimaryColor: rows.get("email_primary_color") || "#b07a86",
      emailSecondaryColor: rows.get("email_secondary_color") || "#f7e8e8",
      enableEmailSending: rows.get("enable_email_sending") === "true",
      brevoApiKey: rows.get("brevo_api_key") || "",
      brevoContactsEnabled: rows.get("brevo_contacts_enabled") === "true",
      instagramUrl: rows.get("instagram_url") || "",
      facebookUrl: rows.get("facebook_url") || "",
      youtubeUrl: rows.get("youtube_url") || "",
    };
  } catch (error) {
    console.warn("[brevo] could not load email branding settings; using defaults", error);
    return {
      storeName: "Superb Creations",
      contactEmail: ADMIN_DEFAULT,
      supportEmail: ADMIN_DEFAULT,
      businessEmail: ADMIN_DEFAULT,
      phoneNumber: "+91 70062 02496",
      senderName: "Superb Creations",
      senderEmail: "",
      replyToEmail: ADMIN_DEFAULT,
      companyAddress: "",
      emailLogoUrl: "",
      emailFooter: "Thank you for shopping with Superb Creations.",
      emailPrimaryColor: "#b07a86",
      emailSecondaryColor: "#f7e8e8",
      enableEmailSending: false,
      brevoApiKey: "",
      brevoContactsEnabled: false,
      instagramUrl: "",
      facebookUrl: "",
      youtubeUrl: "",
    };
  }
}

async function logEmail(args: {
  recipient: string;
  templateKey?: string | null;
  subject: string;
  status: string;
  providerMessageId?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("email_logs")
      .insert({
        recipient: args.recipient,
        template_key: args.templateKey ?? null,
        subject: args.subject,
        status: args.status,
        provider: "brevo",
        provider_message_id: args.providerMessageId ?? null,
        error: args.error ?? null,
        delivered_at: args.status === "sent" ? new Date().toISOString() : null,
        metadata: args.metadata ?? {},
      })
      .select("id")
      .maybeSingle();
    return data?.id as string | undefined;
  } catch (error) {
    console.warn("[brevo] email log failed", error);
    return undefined;
  }
}

async function queueFailedEmail(args: {
  recipient: string;
  templateKey: string;
  subject: string;
  variables: Record<string, unknown>;
  lastError: string;
  idempotencyKey?: string;
  emailLogId?: string;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("email_queue").upsert(
      {
        recipient: args.recipient,
        template_key: args.templateKey,
        subject: args.subject,
        variables: args.variables,
        status: "queued",
        next_attempt_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        idempotency_key: args.idempotencyKey ?? null,
        last_error: args.lastError,
        email_log_id: args.emailLogId ?? null,
      },
      { onConflict: "idempotency_key" },
    );
  } catch (error) {
    console.warn("[brevo] failed-email queue write failed", error);
  }
}

async function sendBrevo(args: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  templateKey?: string;
  variables?: Record<string, unknown>;
  idempotencyKey?: string;
}) {
  const settings = await loadEmailSettings();
  const recipients = Array.isArray(args.to) ? args.to : [args.to];
  if (!settings.enableEmailSending) {
    console.warn("[brevo] email sending disabled in Business Settings — skipping email send");
    await Promise.all(
      recipients.map((recipient) =>
        logEmail({
          recipient,
          templateKey: args.templateKey,
          subject: args.subject,
          status: "skipped",
          error: "Email sending disabled",
        }),
      ),
    );
    return { ok: false as const, skipped: true as const };
  }
  if (!settings.brevoApiKey) {
    console.warn("[brevo] API key missing in Business Settings — skipping email send");
    await Promise.all(
      recipients.map((recipient) =>
        logEmail({
          recipient,
          templateKey: args.templateKey,
          subject: args.subject,
          status: "skipped",
          error: "Brevo API key missing",
        }),
      ),
    );
    return { ok: false as const, skipped: true as const };
  }
  if (!settings.senderEmail) {
    console.warn("[brevo] sender email missing in Business Settings — skipping email send");
    await Promise.all(
      recipients.map((recipient) =>
        logEmail({
          recipient,
          templateKey: args.templateKey,
          subject: args.subject,
          status: "skipped",
          error: "Sender email missing",
        }),
      ),
    );
    return { ok: false as const, skipped: true as const };
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": settings.brevoApiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: settings.senderName, email: settings.senderEmail },
      to: recipients.map((email) => ({ email })),
      replyTo: settings.replyToEmail ? { email: settings.replyToEmail } : undefined,
      subject: args.subject,
      htmlContent: args.html,
      textContent: args.text,
      tags: args.templateKey ? [args.templateKey] : undefined,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    const logs = await Promise.all(
      recipients.map((recipient) =>
        logEmail({
          recipient,
          templateKey: args.templateKey,
          subject: args.subject,
          status: "failed",
          error: text,
          metadata: { status: res.status },
        }),
      ),
    );
    await Promise.all(
      recipients.map((recipient, index) =>
        queueFailedEmail({
          recipient,
          templateKey: args.templateKey || "custom",
          subject: args.subject,
          variables: args.variables ?? {},
          lastError: text,
          idempotencyKey: args.idempotencyKey
            ? `${args.idempotencyKey}:${recipient}`
            : undefined,
          emailLogId: logs[index],
        }),
      ),
    );
    console.error("[brevo] send failed", res.status, text);
    return { ok: false as const, error: text };
  }
  const json = (await res.json()) as { messageId?: string };
  await Promise.all(
    recipients.map((recipient) =>
      logEmail({
        recipient,
        templateKey: args.templateKey,
        subject: args.subject,
        status: "sent",
        providerMessageId: json.messageId,
        metadata: { response: json },
      }),
    ),
  );
  return { ok: true as const, id: json.messageId };
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

function renderTemplate(raw: string, vars: Record<string, unknown>) {
  return raw.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => String(vars[key] ?? ""));
}

function shell(title: string, body: string, settings: EmailSettings) {
  const logo = settings.emailLogoUrl
    ? `<img src="${escape(settings.emailLogoUrl)}" alt="${escape(settings.storeName)}" style="display:block;max-height:56px;max-width:180px;margin-bottom:10px" />`
    : "";
  return `<!doctype html><html><body style="margin:0;background:${escape(settings.emailSecondaryColor)};font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${escape(settings.emailSecondaryColor)};padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">
        <tr><td style="padding:24px 28px;border-bottom:1px solid #eee;border-top:4px solid ${escape(settings.emailPrimaryColor)}">
          ${logo}
          <div style="font-family:Georgia,serif;font-size:22px;font-weight:600;letter-spacing:.5px">${escape(settings.storeName)}</div>
          <div style="font-size:12px;color:#888;margin-top:2px">${escape(title)}</div>
        </td></tr>
        <tr><td style="padding:24px 28px">${body}</td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #eee;font-size:12px;color:#888">
          ${escape(settings.emailFooter)}<br/>
          ${settings.companyAddress ? `${escape(settings.companyAddress)}<br/>` : ""}
          Need help? Reply to this email or contact ${escape(settings.supportEmail)}
          ${settings.phoneNumber ? ` · ${escape(settings.phoneNumber)}` : ""}.<br/>
          ${settings.instagramUrl ? `<a href="${escape(settings.instagramUrl)}" style="color:${escape(settings.emailPrimaryColor)};margin-right:10px">Instagram</a>` : ""}
          ${settings.facebookUrl ? `<a href="${escape(settings.facebookUrl)}" style="color:${escape(settings.emailPrimaryColor)};margin-right:10px">Facebook</a>` : ""}
          ${settings.youtubeUrl ? `<a href="${escape(settings.youtubeUrl)}" style="color:${escape(settings.emailPrimaryColor)}">YouTube</a>` : ""}
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`;
}

async function loadTemplate(key: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("email_templates")
    .select("*")
    .eq("key", key)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return data as any | null;
}

export async function sendTemplatedEmail(args: {
  templateKey: string;
  to: string | string[];
  variables?: Record<string, unknown>;
  idempotencyKey?: string;
}) {
  const settings = await loadEmailSettings();
  const template = await loadTemplate(args.templateKey);
  const variables = { store_name: settings.storeName, support_email: settings.supportEmail, ...(args.variables ?? {}) };
  const subject = template
    ? renderTemplate(template.subject, variables)
    : String(variables.subject || settings.storeName);
  const html = template
    ? renderTemplate(template.body_html, variables)
    : String(variables.body_html || "");
  const text = template
    ? renderTemplate(template.body_text || "", variables)
    : String(variables.body_text || "");
  return sendBrevo({
    to: args.to,
    subject,
    html: shell(template?.name || subject, html, settings),
    text,
    templateKey: args.templateKey,
    variables,
    idempotencyKey: args.idempotencyKey,
  });
}

export async function processEmailQueueBatch(limit = 25) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await (supabaseAdmin as any)
    .from("email_queue")
    .select("*")
    .in("status", ["queued", "failed"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  let sent = 0;
  let failed = 0;
  let permanentlyFailed = 0;

  for (const row of (rows ?? []).filter((item: any) => Number(item.attempts || 0) < Number(item.max_attempts || 5))) {
    const attempts = Number(row.attempts || 0) + 1;
    try {
      const result = await sendTemplatedEmail({
        templateKey: row.template_key,
        to: row.recipient,
        variables: row.variables ?? {},
        idempotencyKey: row.idempotency_key || `queue:${row.id}`,
      });
      if (result.ok) {
        sent += 1;
        await (supabaseAdmin as any)
          .from("email_queue")
          .update({
            status: "sent",
            attempts,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      } else {
        throw new Error((result as any).error || "Email send skipped or failed");
      }
    } catch (error) {
      failed += 1;
      const maxAttempts = Number(row.max_attempts || 5);
      const permanent = attempts >= maxAttempts;
      if (permanent) permanentlyFailed += 1;
      const delayMinutes = Math.min(24 * 60, Math.pow(2, attempts) * 5);
      await (supabaseAdmin as any)
        .from("email_queue")
        .update({
          status: permanent ? "permanently_failed" : "failed",
          attempts,
          next_attempt_at: new Date(Date.now() + delayMinutes * 60 * 1000).toISOString(),
          permanently_failed_at: permanent ? new Date().toISOString() : null,
          last_error: error instanceof Error ? error.message.slice(0, 1000) : "Email queue processing failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
  }

  return { scanned: rows?.length ?? 0, sent, failed, permanentlyFailed };
}

export async function syncBrevoContact(args: {
  email: string;
  name?: string;
  lists?: string[];
  attributes?: Record<string, unknown>;
}) {
  const settings = await loadEmailSettings();
  if (!settings.enableEmailSending || !settings.brevoContactsEnabled || !settings.brevoApiKey) {
    return { ok: false as const, skipped: true as const };
  }
  const res = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: {
      "api-key": settings.brevoApiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email: args.email,
      attributes: { FIRSTNAME: args.name || "", ...(args.attributes ?? {}) },
      updateEnabled: true,
    }),
  });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const text = res.ok ? "" : await res.text();
  await Promise.all(
    (args.lists ?? ["Customers"]).map((listName) =>
      supabaseAdmin.from("brevo_sync").upsert(
        {
          entity_type: "contact",
          entity_id: args.email.toLowerCase(),
          list_name: listName,
          status: res.ok ? "synced" : "failed",
          last_error: text || null,
          synced_at: res.ok ? new Date().toISOString() : null,
        },
        { onConflict: "entity_type,entity_id,list_name" },
      ),
    ),
  );
  return { ok: res.ok as boolean, error: text || null };
}

export const notificationSchema = z.object({
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

export async function sendOrderNotificationsForOrder(
  data: z.infer<typeof notificationSchema>,
) {
    const settings = await loadEmailSettings();
    const adminEmail = settings.businessEmail || settings.contactEmail || ADMIN_DEFAULT;
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
      sendBrevo({
        to: adminEmail,
        subject: `New order — ${data.customerName} (${inr(data.total)})`,
        html: shell("New order received", adminBody, settings),
        templateKey: "admin_order_created",
        variables: {
          customer_name: data.customerName,
          total: inr(data.total),
          payment_method: data.paymentMethod,
        },
        idempotencyKey: `admin-order-created:${data.orderId}`,
      }),
      data.customerEmail
        ? sendBrevo({
            to: data.customerEmail,
            subject: `Order confirmed — ${settings.storeName}`,
            html: shell("Order confirmation", customerBody, settings),
            templateKey: "order_confirmed",
            variables: {
              customer_name: data.customerName,
              order_number: `#${data.orderId.slice(0, 8).toUpperCase()}`,
              total: inr(data.total),
            },
            idempotencyKey: `order-confirmed:${data.orderId}`,
          })
        : Promise.resolve({ ok: false as const, skipped: true as const }),
    ]);
    if (data.customerEmail) {
      syncBrevoContact({
        email: data.customerEmail,
        name: data.customerName,
        lists: ["Customers"],
      }).catch((error) => console.warn("[brevo] contact sync failed", error));
    }

    return {
      admin: adminRes.status === "fulfilled" ? adminRes.value : { ok: false, error: String(adminRes.reason) },
      customer: customerRes.status === "fulfilled" ? customerRes.value : { ok: false, error: String(customerRes.reason) },
      emailEnabled: settings.enableEmailSending,
    };
}

export async function sendOrderStatusEmail(args: {
  orderId: string;
  templateKey: string;
  variables?: Record<string, unknown>;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id,order_number,customer_name,email,total,tracking_number,courier_name,estimated_delivery_date,payment_utr,payment_rejection_reason")
    .eq("id", args.orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order?.email) return { ok: false as const, skipped: true as const };
  return sendTemplatedEmail({
    templateKey: args.templateKey,
    to: order.email,
    variables: {
      customer_name: order.customer_name,
      order_number: order.order_number || `#${order.id.slice(0, 8).toUpperCase()}`,
      total: inr(Number(order.total || 0)),
      tracking_info: [order.courier_name, order.tracking_number, order.estimated_delivery_date].filter(Boolean).join(" · "),
      payment_utr: order.payment_utr || "",
      reason: order.payment_rejection_reason || "",
      ...(args.variables ?? {}),
    },
    idempotencyKey: `${args.templateKey}:${args.orderId}:${JSON.stringify(args.variables ?? {})}`,
  });
}

export const sendOrderNotifications = createServerFn({ method: "POST" })
  .inputValidator((data) => notificationSchema.parse(data))
  .handler(async ({ data }) => sendOrderNotificationsForOrder(data));

const testEmailSchema = z.object({
  accessToken: z.string().min(20),
  to: z.string().email(),
});

const welcomeEmailSchema = z.object({
  accessToken: z.string().min(20),
});

export const ensureWelcomeEmailForUser = createServerFn({ method: "POST" })
  .inputValidator((data) => welcomeEmailSchema.parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const { getSupabaseServerEnv } = await import("@/lib/env.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authEnv = getSupabaseServerEnv();
    if (!authEnv.url || !authEnv.publishableKey) {
      console.warn("[welcome-email] Supabase auth env missing; welcome email check skipped");
      return { ok: false, skipped: true, reason: "auth_env_missing" };
    }
    const authClient = createClient(authEnv.url, authEnv.publishableKey, {
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    const { data: userResult, error: userError } = await authClient.auth.getUser(data.accessToken);
    if (userError || !userResult.user?.email) {
      return { ok: false, skipped: true, reason: "user_not_available" };
    }

    const user = userResult.user;
    const idempotencyKey = `welcome:${user.id}`;
    const { data: existing, error: existingError } = await (supabaseAdmin as any)
      .from("email_queue")
      .select("id,status")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existingError) throw existingError;

    if (!existing) {
      const name =
        String(user.user_metadata?.full_name || user.user_metadata?.name || "").trim() ||
        user.email.split("@")[0] ||
        "there";
      const { error: insertError } = await (supabaseAdmin as any).from("email_queue").insert({
        recipient: user.email.toLowerCase(),
        user_id: user.id,
        template_key: "welcome",
        subject: "Welcome to Superb Creations",
        variables: {
          customer_name: name,
          store_name: "Superb Creations",
          user_email: user.email.toLowerCase(),
        },
        status: "queued",
        next_attempt_at: new Date().toISOString(),
        idempotency_key: idempotencyKey,
        max_attempts: 5,
      });
      if (insertError) throw insertError;
    }

    const { data: queueRow } = await (supabaseAdmin as any)
      .from("email_queue")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (!queueRow || queueRow.status === "sent") {
      return { ok: true, queued: Boolean(queueRow), status: queueRow?.status || "missing" };
    }

    try {
      const send = await sendTemplatedEmail({
        templateKey: queueRow.template_key || "welcome",
        to: queueRow.recipient,
        variables: queueRow.variables ?? {},
        idempotencyKey,
      });
      await (supabaseAdmin as any)
        .from("email_queue")
        .update({
          status: send.ok ? "sent" : "failed",
          attempts: Number(queueRow.attempts || 0) + 1,
          last_error: send.ok ? null : ((send as any).error || "Welcome email send skipped or failed"),
          next_attempt_at: send.ok ? queueRow.next_attempt_at : new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", queueRow.id);
      return { ok: send.ok, queued: true, status: send.ok ? "sent" : "failed" };
    } catch (error) {
      await (supabaseAdmin as any)
        .from("email_queue")
        .update({
          status: "failed",
          attempts: Number(queueRow.attempts || 0) + 1,
          last_error: error instanceof Error ? error.message.slice(0, 1000) : "Welcome email send failed",
          next_attempt_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", queueRow.id);
      console.warn("[welcome-email] send failed; queued for retry", error);
      return { ok: false, queued: true, status: "failed" };
    }
  });

export const sendBrevoTestEmail = createServerFn({ method: "POST" })
  .inputValidator((data) => testEmailSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireOwnerAdmin } = await import("@/lib/admin.server");
    await requireOwnerAdmin(data.accessToken);
    return sendTemplatedEmail({
      templateKey: "announcement",
      to: data.to,
      variables: {
        announcement_title: "Brevo test email",
        announcement_body: "Your Superb Creations Brevo email settings are working.",
      },
      idempotencyKey: `brevo-test:${Date.now()}:${data.to}`,
    });
  });

export const checkBrevoConnection = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ accessToken: z.string().min(20) }).parse(data))
  .handler(async ({ data }) => {
    const { requireOwnerAdmin } = await import("@/lib/admin.server");
    await requireOwnerAdmin(data.accessToken);
    const settings = await loadEmailSettings();
    if (!settings.brevoApiKey) return { ok: false, error: "Brevo API key missing" };
    const res = await fetch("https://api.brevo.com/v3/account", {
      headers: {
        "api-key": settings.brevoApiKey,
        Accept: "application/json",
      },
    });
    if (!res.ok) return { ok: false, error: await res.text() };
    return { ok: true, account: await res.json() };
  });

const sendCampaignSchema = z.object({
  accessToken: z.string().min(20),
  campaignId: z.string().uuid(),
});

export const sendNewsletterCampaign = createServerFn({ method: "POST" })
  .inputValidator((data) => sendCampaignSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireOwnerAdmin } = await import("@/lib/admin.server");
    await requireOwnerAdmin(data.accessToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("newsletter_campaigns")
      .select("*")
      .eq("id", data.campaignId)
      .maybeSingle();
    if (campaignError) throw campaignError;
    if (!campaign) throw new Error("Campaign not found.");

    const { data: subscribers, error: subscribersError } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("email,user_id")
      .eq("subscribed", true)
      .not("confirmed_at", "is", null);
    if (subscribersError) throw subscribersError;
    const recipients = [...new Map((subscribers ?? []).map((s: any) => [String(s.email).toLowerCase(), s])).values()];
    for (const recipient of recipients) {
      const send = await sendBrevo({
        to: recipient.email,
        subject: campaign.subject,
        html: shell(campaign.name, campaign.body_html, await loadEmailSettings()),
        templateKey: "newsletter",
        variables: {
          campaign_subject: campaign.subject,
          campaign_body: campaign.body_html,
        },
        idempotencyKey: `campaign:${campaign.id}:${recipient.email}`,
      });
      await supabaseAdmin.from("newsletter_campaign_recipients").upsert(
        {
          campaign_id: campaign.id,
          email: recipient.email,
          user_id: recipient.user_id,
          status: send.ok ? "sent" : "failed",
        },
        { onConflict: "campaign_id,email" },
      );
    }
    await supabaseAdmin
      .from("newsletter_campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", campaign.id);
    return { ok: true, sent: recipients.length };
  });

const shippedSchema = z.object({
  orderId: z.string().uuid(),
  customerName: z.string(),
  customerEmail: z.string().email(),
  trackingInfo: z.string().optional(),
});

export const sendOrderShippedEmail = createServerFn({ method: "POST" })
  .inputValidator((data) => shippedSchema.parse(data))
  .handler(async ({ data }) =>
    sendTemplatedEmail({
      templateKey: "order_shipped",
      to: data.customerEmail,
      variables: {
        customer_name: data.customerName,
        order_number: `#${data.orderId.slice(0, 8).toUpperCase()}`,
        tracking_info: data.trackingInfo || "",
      },
      idempotencyKey: `order-shipped:${data.orderId}`,
    }),
  );
