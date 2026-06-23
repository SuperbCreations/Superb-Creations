const PUBLIC_ENV_KEYS = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"] as const;

export type PublicEnvKey = (typeof PUBLIC_ENV_KEYS)[number];

export function getPublicEnv() {
  return {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || "",
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
    VERCEL_URL: import.meta.env.VERCEL_URL || "",
    VERCEL_GIT_COMMIT_SHA: import.meta.env.VERCEL_GIT_COMMIT_SHA || "",
  };
}

export function validatePublicEnv() {
  const env = getPublicEnv();
  const missing = PUBLIC_ENV_KEYS.filter((key) => !env[key]);
  return {
    ok: missing.length === 0,
    missing,
  };
}

export function publicProjectRef() {
  const url = getPublicEnv().VITE_SUPABASE_URL;
  try {
    return new URL(url).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}
