import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Superb Creations" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast.success("Account created. You're signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
      }
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Please try again.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <section className="container-boutique flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-md rounded-sm border border-border bg-secondary/20 p-8">
        <p className="eyebrow text-center">Superb Creations</p>
        <h1 className="mt-2 text-center font-display text-3xl">
          {mode === "login" ? "Welcome back" : "Create account"}
        </h1>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-full border border-border bg-background py-3 text-sm transition-colors hover:bg-secondary disabled:opacity-60"
        >
          <img src="https://www.google.com/favicon.ico" alt="" width={16} height={16} />
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-4">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
          )}
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-primary py-3.5 text-xs uppercase tracking-[0.22em] text-primary-foreground disabled:opacity-60"
          >
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-foreground underline underline-offset-4"
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            ← Back to store
          </Link>
        </p>
      </div>
    </section>
  );
}
