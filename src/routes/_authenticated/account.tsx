import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/products";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "Your account — Superb Creations" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { user, signOut } = useAuth();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const fullName =
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ||
    user?.email?.split("@")[0] ||
    "there";

  return (
    <section className="container-boutique py-12 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your account</p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl">Hi {fullName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <button
          onClick={signOut}
          className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-xs uppercase tracking-[0.2em]"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>

      <h2 className="mt-12 font-display text-2xl">Order history</h2>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-sm border border-dashed border-border py-16 text-center">
          <Package className="text-muted-foreground" size={32} />
          <p className="text-sm text-muted-foreground">No orders yet.</p>
          <Link
            to="/shop"
            className="rounded-full bg-primary px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((o: any) => (
            <div key={o.id} className="rounded-sm border border-border p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {new Date(o.created_at).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  <p className="mt-1 font-display text-lg">Order #{o.id.slice(0, 8)}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg">{inr(o.total)}</p>
                  <p className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                    {o.status} · {o.payment_method}
                  </p>
                </div>
              </div>
              <ul className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
                {(o.items as any[]).map((it, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>
                      {it.name}
                      {it.variant_label && (
                        <span className="text-muted-foreground"> · {it.variant_label}</span>
                      )}
                      <span className="text-muted-foreground"> × {it.qty}</span>
                    </span>
                    <span>{inr(it.price * it.qty)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}