import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useProducts, CATEGORIES, useAllVariants } from "@/lib/products";
import { ProductCard } from "@/components/site/ProductCard";
import { useAllProductRatings } from "@/lib/reviews";
import { trackAnalyticsEvent } from "@/lib/analytics";

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
  const [sort, setSort] = useState("relevance");
  const [availability, setAvailability] = useState("all");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState("0");
  const [size, setSize] = useState("all");
  const [color, setColor] = useState("all");
  const { data: products = [], isLoading } = useProducts();
  const { data: ratings = {} } = useAllProductRatings();

  const { data: allVariants = [] } = useAllVariants();
  const variantOptions = useMemo(() => {
    const variantsByProduct = new Map<string, any[]>();
    for (const variant of allVariants as any[]) {
      variantsByProduct.set(variant.product_id, [
        ...(variantsByProduct.get(variant.product_id) ?? []),
        variant,
      ]);
    }
    return {
      variantsByProduct,
      sizes: Array.from(new Set((allVariants as any[]).map((v) => v.size).filter(Boolean))),
      colors: Array.from(new Set((allVariants as any[]).map((v) => v.color).filter(Boolean))),
    };
  }, [allVariants]);

  const filtered = useMemo(() => {
    const max = Number(maxPrice);
    const min = Number(minRating || 0);
    const list = products.filter((p) => {
      const variants = variantOptions.variantsByProduct.get(p.id) ?? [];
      const rating = ratings[p.id]?.avg ?? 0;
      return (
        (active === "All" || p.category === active) &&
        (availability === "all" || (availability === "in_stock" ? p.in_stock && p.stock > 0 : !p.in_stock || p.stock === 0)) &&
        (!maxPrice || p.price <= max) &&
        rating >= min &&
        (size === "all" || variants.some((v) => v.size === size)) &&
        (color === "all" || variants.some((v) => v.color === color))
      );
    });
    return [...list].sort((a, b) => {
      if (sort === "price_low") return a.price - b.price;
      if (sort === "price_high") return b.price - a.price;
      if (sort === "rating") return (ratings[b.id]?.avg ?? 0) - (ratings[a.id]?.avg ?? 0);
      if (sort === "alphabetical") return a.name.localeCompare(b.name);
      if (sort === "best_selling") return (b.lifetime_sales ?? 0) - (a.lifetime_sales ?? 0);
      if (sort === "newest") return b.id.localeCompare(a.id);
      return 0;
    });
  }, [active, availability, color, maxPrice, minRating, products, ratings, size, sort, variantOptions]);

  useEffect(() => {
    trackAnalyticsEvent({
      eventType: "filter_usage",
      metadata: {
        category: active,
        sort,
        availability,
        maxPrice: maxPrice || "",
        minRating,
        size,
        color,
      },
    });
  }, [active, availability, color, maxPrice, minRating, size, sort]);

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
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <select className="rounded-md border border-border bg-background px-3 py-2.5 text-sm" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="relevance">Relevance</option>
            <option value="newest">Newest</option>
            <option value="best_selling">Best Selling</option>
            <option value="rating">Rating</option>
            <option value="price_low">Price Low</option>
            <option value="price_high">Price High</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
          <select className="rounded-md border border-border bg-background px-3 py-2.5 text-sm" value={availability} onChange={(e) => setAvailability(e.target.value)}>
            <option value="all">All availability</option>
            <option value="in_stock">In stock</option>
            <option value="out_of_stock">Out of stock</option>
          </select>
          <input className="rounded-md border border-border bg-background px-3 py-2.5 text-sm" placeholder="Max price" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          <select className="rounded-md border border-border bg-background px-3 py-2.5 text-sm" value={minRating} onChange={(e) => setMinRating(e.target.value)}>
            <option value="0">Any rating</option>
            <option value="4">4+ stars</option>
            <option value="3">3+ stars</option>
          </select>
          <select className="rounded-md border border-border bg-background px-3 py-2.5 text-sm" value={size} onChange={(e) => setSize(e.target.value)}>
            <option value="all">All sizes</option>
            {variantOptions.sizes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="rounded-md border border-border bg-background px-3 py-2.5 text-sm" value={color} onChange={(e) => setColor(e.target.value)}>
            <option value="all">All colours</option>
            {variantOptions.colors.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
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
            No products available yet.
          </p>
        )}
      </section>
    </>
  );
}
