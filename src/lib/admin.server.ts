import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuthEnv } from "@/lib/env.server";

export const OWNER_ADMIN_EMAIL = "superbcreations55@gmail.com";

export async function requireOwnerAdmin(accessToken: string) {
  if (!accessToken) {
    throw new Error("Admin authentication is required.");
  }

  const { url, publishableKey } = requireSupabaseAuthEnv();

  const supabase = createClient<Database>(url, publishableKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || data.user?.email?.toLowerCase() !== OWNER_ADMIN_EMAIL) {
    throw new Error("Only the store owner can perform this action.");
  }

  return data.user;
}
