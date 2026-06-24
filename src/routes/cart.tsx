import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/products";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Your Bag — Superb Creations" }] }),
  component: CartPage,
});

function CartPage() {
  const { items, setQty, removeItem, subtotal } = useCart();

  return (
    <section className="container-boutique py-12 md:py-16">
      <h1 className="font-display text-4xl md:text-5xl">Your bag</h1>

      {items.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-4 py-16 text-center">
          <ShoppingBag className="text-muted-foreground" size={36} />
          <p className="text-muted-foreground">Your bag is empty.</p>
          <Link
            to="/shop"
            className="rounded-full bg-primary px-7 py-3 text-xs uppercase tracking-[0.22em] text-primary-foreground"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          <div className="divide-y divide-border border-y border-border">
            {items.map((item) => (
              <div key={item.id} className="flex gap-4 py-5">
                <Link
                  to="/product/$slug"
                  params={{ slug: item.slug }}
                  className="h-28 w-24 shrink-0 overflow-hidden rounded-sm bg-secondary"
                >
                  {item.image_url && (
                    <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                  )}
                </Link>
                <div className="flex flex-1 flex-col">
                  <div className="flex justify-between gap-3">
                    <Link to="/product/$slug" params={{ slug: item.slug }} className="font-display text-lg">
                      {item.name}
                    </Link>
                    <p className="font-display text-lg">{inr(item.price * item.qty)}</p>
                  </div>
                  {item.variant_label && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.variant_label}</p>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">{inr(item.price)} each</p>
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQty(item.id, item.qty - 1)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border"
                        aria-label="Decrease"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-6 text-center">{item.qty}</span>
                      <button
                        onClick={() => setQty(item.id, item.qty + 1)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border"
                        aria-label="Increase"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={15} /> Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <aside className="h-fit rounded-sm border border-border bg-secondary/30 p-6">
            <h2 className="font-display text-2xl">Order summary</h2>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{inr(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>{subtotal >= 2500 ? "Free" : "Calculated at checkout"}</span>
              </div>
            </div>
            <div className="mt-5 flex justify-between border-t border-border pt-4 font-display text-lg">
              <span>Total</span>
              <span>{inr(subtotal)}</span>
            </div>
            <Link
              to="/checkout"
              className="mt-6 block w-full rounded-full bg-primary py-3.5 text-center text-xs uppercase tracking-[0.22em] text-primary-foreground"
            >
              Proceed to checkout
            </Link>
            <Link
              to="/shop"
              className="mt-3 block text-center text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
            >
              Continue shopping
            </Link>
          </aside>
        </div>
      )}
    </section>
  );
}
