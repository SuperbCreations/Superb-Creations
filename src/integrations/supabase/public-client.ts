import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getPublicEnv, publicProjectRef, validatePublicEnv } from "@/lib/env";

const publicEnv = getPublicEnv();
const SUPABASE_URL = publicEnv.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = publicEnv.VITE_SUPABASE_PUBLISHABLE_KEY;

const validation = validatePublicEnv();
if (!validation.ok) {
  const message = `Missing public Supabase environment variable(s): ${validation.missing.join(", ")}.`;
  console.error(`[Supabase] ${message}`);
  throw new Error(message);
}

export function publicSupabaseProjectRef() {
  return publicProjectRef();
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
