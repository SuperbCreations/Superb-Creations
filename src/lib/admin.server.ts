import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const OWNER_ADMIN_EMAIL = "superbcreations55@gmail.com";

export async function requireOwnerAdmin(accessToken: string) {
  if (!accessToken) {
    throw new Error("Admin authentication is required.");
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    throw new Error("Supabase auth is not configured.");
  }

  const supabase = createClient<Database>(supabaseUrl, publishableKey, {
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
