import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ensureWelcomeEmailForUser } from "@/lib/notifications.functions";

const OWNER_ADMIN_EMAIL = "superbcreations55@gmail.com";
const BUSINESS_SETTINGS_QUERY_KEY = ["business-settings"] as const;

function clearSupabaseAuthStorage() {
  if (typeof window === "undefined") return;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (let i = storage.length - 1; i >= 0; i -= 1) {
      const key = storage.key(i);
      if (key?.startsWith("sb-") && key.includes("auth-token")) {
        storage.removeItem(key);
      }
    }
  }
}

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const ensureWelcomeEmail = useServerFn(ensureWelcomeEmailForUser);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const resolveRole = (email: string | undefined) => {
      setIsAdmin(email?.toLowerCase() === OWNER_ADMIN_EMAIL);
    };
    const resetBusinessSettings = () => {
      queryClient.removeQueries({ queryKey: BUSINESS_SETTINGS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: BUSINESS_SETTINGS_QUERY_KEY });
    };
    const triggerWelcomeEmail = (sess: Session | null) => {
      if (!sess?.access_token || !sess.user?.id) return;
      ensureWelcomeEmail({ data: { accessToken: sess.access_token } }).then((result) => {
        if (!result?.ok && !result?.skipped) {
          console.warn("[welcome-email] background send did not complete", result);
        }
      }).catch((error) => {
        console.warn("[welcome-email] background check failed", error);
      });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      resetBusinessSettings();
      // Defer Supabase calls to avoid deadlocks inside the callback.
      setTimeout(() => {
        resolveRole(sess?.user?.email);
        triggerWelcomeEmail(sess);
      }, 0);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      resolveRole(data.session?.user?.email);
      triggerWelcomeEmail(data.session);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [ensureWelcomeEmail, queryClient]);

  const signOut = async () => {
    await supabase.auth.signOut({ scope: "local" });
    clearSupabaseAuthStorage();
    setSession(null);
    setUser(null);
    setIsAdmin(false);
    queryClient.removeQueries({ queryKey: BUSINESS_SETTINGS_QUERY_KEY });
    queryClient.clear();
    if (typeof window !== "undefined") {
      window.location.replace("/");
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
