import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { MessageCircle, ShoppingBag, ArrowLeft, Check, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useProduct,
  useProducts,
  useVariants,
  whatsappOrderLink,
  inr,
  effectivePrice,
  effectiveStock,
  type Variant,
  type Product,
} from "@/lib/products";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { useReviews, useSubmitReview } from "@/lib/reviews";
import { ProductCard } from "@/components/site/ProductCard";

export const Route = createFileRoute("/product/$slug")({
  component: ProductPage,
  errorComponent: () => (
    <div className="container-boutique py-24 text-center">
      <p className="text-muted-foreground">This piece could not be loaded.</p>
      <Link to="/shop" className="mt-4 inline-block underline">
        Back to shop
      </Link>
    </div>
  ),
  notFoundComponent: () => (
    <div className="container-boutique py-24 text-center">Product not found.</div>
  ),
});

function ProductPage() {
  const { slug } = useParams({ from: "/product/$slug" });
  const { data: product, isLoading } = useProduct(slug);
  const { data: all = [] } = useProducts();
  const { data: variants = [] } = useVariants(product?.id);
  const { addItem, setOpen } = useCart();
  const [added, setAdded] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="container-boutique grid gap-10 py-12 md:grid-cols-2">
        <div className="aspect-[4/5] animate-pulse bg-secondary" />
        <div className="space-y-4">
          <div className="h-8 w-2/3 animate-pulse bg-secondary" />
          <div className="h-4 w-1/3 animate-pulse bg-secondary" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container-boutique py-24 text-center">
        <p className="text-muted-foreground">This piece is no longer available.</p>
        <Link to="/shop" className="mt-4 inline-block underline">
          Back to shop
        </Link>
      </div>
    );
  }

  const related = all.filter((p) => p.id !== product.id).slice(0, 4);
  const hasVariants = variants.length > 0;

  const sizes = Array.from(new Set(variants.map((v) => v.size).filter(Boolean)));
  const colors = Array.from(
    new Map(
      variants
        .filter((v) => v.color)
        .map((v) => [v.color, { name: v.color, hex: v.color_hex }]),
    ).values(),
  );

  const matchVariant = (): Variant | null => {
    if (!hasVariants) return null;
    return (
      variants.find(
        (v) =>
          (sizes.length === 0 || v.size === selectedSize) &&
          (colors.length === 0 || v.color === selectedColor),
      ) ?? null
    );
  };

  const selected = matchVariant();
  const price = effectivePrice(product, selected);
  const stock = effectiveStock(product, selected);
  const canBuy =
    product.in_stock &&
    stock > 0 &&
    (!hasVariants ||
      (sizes.length === 0 || !!selectedSize) &&
        (colors.length === 0 || !!selectedColor));

  return (
    <>
      <div className="container-boutique pt-8">
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> Back to shop
        </Link>
      </div>

      <section className="container-boutique grid gap-10 py-8 md:grid-cols-2 md:gap-16 md:py-12">
        <div className="hover-zoom aspect-[4/5] overflow-hidden rounded-sm bg-secondary shadow-soft">
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="md:py-6">
          <p className="eyebrow">{product.category}</p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl">{product.name}</h1>
          <p className="mt-4 font-display text-2xl">{inr(price)}</p>
          {!product.in_stock || stock === 0 ? (
            <p className="mt-3 text-sm font-medium text-destructive">Currently sold out</p>
          ) : stock <= 5 ? (
            <p className="mt-3 text-sm font-medium text-primary">Only {stock} left</p>
          ) : null}
          <p className="mt-6 max-w-md leading-relaxed text-muted-foreground">
            {product.description}
          </p>

          {sizes.length > 0 && (
            <div className="mt-6">
              <p className="eyebrow">Size</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {sizes.map((s) => {
                  const active = selectedSize === s;
                  const anyStock = variants
                    .filter((v) => v.size === s)
                    .some((v) => v.stock > 0);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSize(s)}
                      disabled={!anyStock}
                      className={
                        "min-w-[44px] rounded-full border px-4 py-2 text-xs uppercase tracking-[0.18em] transition-colors " +
                        (active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50") +
                        (!anyStock ? " line-through opacity-50" : "")
                      }
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {colors.length > 0 && (
            <div className="mt-5">
              <p className="eyebrow">
                Colour{selectedColor && <span className="ml-2 normal-case text-muted-foreground">{selectedColor}</span>}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {colors.map((c) => {
                  const active = selectedColor === c.name;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      title={c.name}
                      onClick={() => setSelectedColor(c.name)}
                      className={
                        "h-9 w-9 rounded-full border-2 transition-transform " +
                        (active ? "border-primary scale-110" : "border-border")
                      }
                      style={{ backgroundColor: c.hex ?? "#ccc" }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!canBuy}
              onClick={() => {
                if (hasVariants && !selected) {
                  toast.error("Please choose size & colour first.");
                  return;
                }
                addItem(product, selected);
                setAdded(true);
                setOpen(true);
                setTimeout(() => setAdded(false), 1500);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-xs uppercase tracking-[0.22em] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {added ? <Check size={15} /> : <ShoppingBag size={15} />}
              {added ? "Added to bag" : "Add to bag"}
            </button>
            <a
              href={whatsappOrderLink(product)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 px-7 py-3.5 text-xs uppercase tracking-[0.22em] transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <MessageCircle size={15} /> Order on WhatsApp
            </a>
          </div>

          <ul className="mt-10 space-y-2 border-t border-border pt-6 text-sm text-muted-foreground">
            <li>Free shipping on orders above ₹2,500</li>
            <li>Handcrafted in India · small batches</li>
            <li>Easy WhatsApp support for sizes & returns</li>
          </ul>
        </div>
      </section>

      <ReviewsSection product={product} />

      {related.length > 0 && (
        <section className="container-boutique py-12 md:py-16">
          <h2 className="font-display text-3xl">You may also like</h2>
          <div className="mt-8 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= Math.round(value) ? "fill-primary text-primary" : "text-muted-foreground"}
        />
      ))}
    </span>
  );
}

function ReviewsSection({ product }: { product: Product }) {
  const { user } = useAuth();
  const { data: reviews = [] } = useReviews(product.id);
  const submit = useSubmitReview(product.id);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const avg = useMemo(
    () => (reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0),
    [reviews],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!body.trim()) {
      toast.error("Please write a short review.");
      return;
    }
    try {
      await submit.mutateAsync({
        rating,
        title: title.trim(),
        body: body.trim(),
        author_name:
          ((user.user_metadata as { full_name?: string } | undefined)?.full_name as string) ||
          user.email?.split("@")[0] ||
          "Customer",
        user_id: user.id,
      });
      setTitle("");
      setBody("");
      setRating(5);
      toast.success("Thanks for your review!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit review.");
    }
  };

  return (
    <section className="container-boutique border-t border-border py-12 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Reviews</p>
          <h2 className="mt-2 font-display text-3xl">What customers say</h2>
        </div>
        {reviews.length > 0 && (
          <div className="flex items-center gap-3">
            <Stars value={avg} size={18} />
            <span className="font-display text-xl">{avg.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">({reviews.length})</span>
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          {reviews.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No reviews yet — be the first to share your thoughts.
            </p>
          )}
          {reviews.map((r) => (
            <article key={r.id} className="rounded-sm border border-border p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{r.author_name || "Customer"}</p>
                <Stars value={r.rating} />
              </div>
              {r.title && <p className="mt-2 font-display text-lg">{r.title}</p>}
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
              <p className="mt-3 text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
              </p>
            </article>
          ))}
        </div>

        <aside className="h-fit rounded-sm border border-border bg-secondary/30 p-6">
          <h3 className="font-display text-xl">Write a review</h3>
          {user ? (
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <p className="eyebrow">Your rating</p>
                <div className="mt-2 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      aria-label={`${n} stars`}
                    >
                      <Star
                        size={24}
                        className={
                          n <= rating ? "fill-primary text-primary" : "text-muted-foreground"
                        }
                      />
                    </button>
                  ))}
                </div>
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (optional)"
                maxLength={120}
                className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Share your experience with this piece"
                maxLength={1000}
                rows={4}
                className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={submit.isPending}
                className="w-full rounded-full bg-primary py-3 text-xs uppercase tracking-[0.22em] text-primary-foreground disabled:opacity-60"
              >
                {submit.isPending ? "Posting…" : "Post review"}
              </button>
            </form>
          ) : (
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>Sign in to share your thoughts on this piece.</p>
              <Link
                to="/auth"
                className="inline-block rounded-full border border-border px-5 py-2 text-xs uppercase tracking-[0.2em] text-foreground"
              >
                Sign in to review
              </Link>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
