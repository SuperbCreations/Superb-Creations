import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  const missing = [
    ...(!SUPABASE_URL ? ["VITE_SUPABASE_URL"] : []),
    ...(!SUPABASE_PUBLISHABLE_KEY ? ["VITE_SUPABASE_PUBLISHABLE_KEY"] : []),
  ];
  const message = `Missing public Supabase environment variable(s): ${missing.join(", ")}.`;
  console.error(`[Supabase] ${message}`);
  throw new Error(message);
}

export function publicSupabaseProjectRef() {
  try {
    return new URL(SUPABASE_URL).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

// Public storefront data intentionally uses this anon-only client so login state
// cannot change public site content through authenticated RLS.
export const publicSupabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: undefined,
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  },
);

if (typeof window !== "undefined") {
  console.info("[public-client] public reads are using anon client", {
    supabaseProjectRef: publicSupabaseProjectRef(),
  });
}
