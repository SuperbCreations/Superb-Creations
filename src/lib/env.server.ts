const REQUIRED_SERVER_ENV = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
] as const;

const OPTIONAL_SERVER_ENV = [
  "CRON_SECRET",
  "BREVO_WEBHOOK_TOKEN",
  "SHIPPING_WEBHOOK_TOKEN",
  "VERCEL_URL",
  "VERCEL_GIT_COMMIT_SHA",
] as const;

let validated = false;

export type ServerEnvKey = (typeof REQUIRED_SERVER_ENV)[number] | (typeof OPTIONAL_SERVER_ENV)[number];

export function getServerEnv() {
  return {
    SUPABASE_URL: process.env.SUPABASE_URL || "",
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "",
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "",
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || "",
    CRON_SECRET: process.env.CRON_SECRET || "",
    BREVO_WEBHOOK_TOKEN: process.env.BREVO_WEBHOOK_TOKEN || "",
    SHIPPING_WEBHOOK_TOKEN: process.env.SHIPPING_WEBHOOK_TOKEN || "",
    VERCEL_URL: process.env.VERCEL_URL || "",
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA || "",
  };
}

export function validateServerEnv(options: { once?: boolean; throwInProduction?: boolean } = {}) {
  if (options.once && validated) return { ok: true, missing: [] as string[] };
  const env = getServerEnv();
  const missing = REQUIRED_SERVER_ENV.filter((key) => !env[key]);
  validated = true;
  if (missing.length > 0) {
    const message = `Missing required server environment variable(s): ${missing.join(", ")}`;
    if (options.throwInProduction !== false && process.env.NODE_ENV === "production") {
      throw new Error(message);
    }
    console.warn(`[env] ${message}`);
  }
  return { ok: missing.length === 0, missing };
}

export function requireCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is not configured.");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const header = request.headers.get("x-cron-secret");
  const urlSecret = new URL(request.url).searchParams.get("secret");
  if (bearer !== secret && header !== secret && urlSecret !== secret) {
    throw new Error("Invalid cron secret.");
  }
}

export function optionalWebhookTokenValid(request: Request, envName: "BREVO_WEBHOOK_TOKEN" | "SHIPPING_WEBHOOK_TOKEN") {
  const token = process.env[envName];
  if (!token) return true;
  const header = request.headers.get("x-webhook-token") || request.headers.get("x-brevo-token") || request.headers.get("x-shipping-token");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const query = new URL(request.url).searchParams.get("token");
  return header === token || bearer === token || query === token;
}
