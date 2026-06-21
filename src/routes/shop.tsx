import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useProducts, CATEGORIES } from "@/lib/products";
import { ProductCard } from "@/components/site/ProductCard";

const categories = ["All", ...CATEGORIES] as const;

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop — Superb Creations" },
      {
        name: "description",
        content:
          "Browse the Superb Creations collection of kurta sets, dresses, sarees and beauty essentials. Order online or via WhatsApp.",
      },
      { property: "og:title", content: "Shop — Superb Creations" },
      { property: "og:description", content: "Quietly elegant women's wear and beauty." },
    ],
  }),
  component: Shop,
});

function Shop() {
  const [active, setActive] = useState<(typeof categories)[number]>("All");
  const { data: products = [], isLoading } = useProducts();

  const filtered = useMemo(
    () => (active === "All" ? products : products.filter((p) => p.category === active)),
    [active, products],
  );

  return (
    <>
      <section className="border-b border-border bg-secondary/40">
        <div className="container-boutique py-16 md:py-20">
          <p className="eyebrow">The Shop</p>
          <h1 className="mt-3 font-display text-5xl md:text-6xl">All pieces</h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            A small, considered collection — refreshed often. Add to bag or tap a
            piece to order on WhatsApp.
          </p>
        </div>
      </section>

      <section className="container-boutique py-12">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={
                "rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] transition-colors " +
                (active === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-foreground/70 hover:border-primary/50")
              }
            >
              {c}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/5] bg-secondary" />
                <div className="mt-4 h-4 w-2/3 bg-secondary" />
                <div className="mt-2 h-4 w-1/3 bg-secondary" />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            More pieces dropping in this category soon.
          </p>
        )}
      </section>
    </>
  );
}
