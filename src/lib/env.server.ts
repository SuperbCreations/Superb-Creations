const REQUIRED_SERVER_ENV = [
  "SUPABASE_URL_OR_ALIAS",
  "SUPABASE_PUBLISHABLE_KEY_OR_ALIAS",
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

export function normalizeSupabaseUrl(url: string) {
  return url.trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
}

function firstEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return { key, value };
  }
  return { key: "", value: "" };
}

export function getSupabaseServerEnv() {
  const url = firstEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
  const publishableKey = firstEnv(
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
  const serviceRoleKey = firstEnv("SUPABASE_SERVICE_ROLE_KEY");

  return {
    url: normalizeSupabaseUrl(url.value),
    urlSource: url.key,
    publishableKey: publishableKey.value,
    publishableKeySource: publishableKey.key,
    serviceRoleKey: serviceRoleKey.value,
    serviceRoleKeySource: serviceRoleKey.key,
  };
}

export function requireSupabaseAuthEnv() {
  const env = getSupabaseServerEnv();
  const missing = [
    ...(!env.url ? ["SUPABASE_URL or VITE_SUPABASE_URL"] : []),
    ...(!env.publishableKey ? ["SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PUBLISHABLE_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY"] : []),
  ];
  if (missing.length > 0) {
    console.warn(`[env] Supabase auth env missing: ${missing.join(", ")}`);
    throw new Error("Authentication service is not configured.");
  }
  if (env.urlSource !== "SUPABASE_URL" || env.publishableKeySource !== "SUPABASE_PUBLISHABLE_KEY") {
    console.warn("[env] Supabase auth is using fallback env aliases", {
      urlSource: env.urlSource,
      publishableKeySource: env.publishableKeySource,
    });
  }
  return { url: env.url, publishableKey: env.publishableKey };
}

export function requireSupabaseServiceRoleEnv() {
  const env = getSupabaseServerEnv();
  const missing = [
    ...(!env.url ? ["SUPABASE_URL or VITE_SUPABASE_URL"] : []),
    ...(!env.serviceRoleKey ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
  ];
  if (missing.length > 0) {
    console.warn(`[env] Supabase service-role env missing: ${missing.join(", ")}`);
    throw new Error("Server database service is not configured.");
  }
  if (env.urlSource !== "SUPABASE_URL") {
    console.warn("[env] Supabase service-role client is using fallback URL alias", {
      urlSource: env.urlSource,
    });
  }
  return { url: env.url, serviceRoleKey: env.serviceRoleKey };
}

export function getServerEnv() {
  const supabase = getSupabaseServerEnv();
  return {
    SUPABASE_URL_OR_ALIAS: supabase.url,
    SUPABASE_PUBLISHABLE_KEY_OR_ALIAS: supabase.publishableKey,
    SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
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
