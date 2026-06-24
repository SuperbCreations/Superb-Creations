import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { MessageCircle, ShoppingBag, ArrowLeft, Check, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useProduct,
  useProducts,
  useVariants,
  useProductImages,
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
import { settingBool, useBusinessSettings, whatsappUrl } from "@/lib/business-settings";
import { useSimilarProducts } from "@/lib/growth";
import { useRecentlyViewed, useTrackRecentlyViewed } from "@/lib/customer-engagement";
import { supabase } from "@/integrations/supabase/client";
import { trackAnalyticsEvent } from "@/lib/analytics";

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
  const { data: productImages = [] } = useProductImages(product?.id);
  const { data: similarProducts = [] } = useSimilarProducts(product);
  const { settings } = useBusinessSettings();
  const { addItem, setOpen } = useCart();
  const { user } = useAuth();
  const trackViewed = useTrackRecentlyViewed(user?.id);
  const { data: recentlyViewed = [] } = useRecentlyViewed(user?.id);
  const [added, setAdded] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState("");

  useEffect(() => {
    if (product?.id) {
      trackViewed.mutate(product.id);
      trackAnalyticsEvent({
        eventType: "product_view",
        productId: product.id,
        userId: user?.id,
        metadata: { slug: product.slug },
      });
    }
  }, [product?.id, product?.slug, trackViewed, user?.id]);

  useEffect(() => {
    const cover =
      productImages.find((image) => image.is_cover)?.image_url ||
      productImages[0]?.image_url ||
      product?.image_url ||
      "";
    setActiveImage(cover);
  }, [product?.image_url, productImages]);

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

  const recentProducts = recentlyViewed
    .map((row: any) => row.products)
    .filter((p: any) => p && p.id !== product.id)
    .slice(0, 4);
  const related = (recentProducts.length > 0 ? recentProducts : all.filter((p) => p.id !== product.id)).slice(0, 4);
  const activeVariants = variants.filter((variant) => variant.active !== false);
  const hasVariants = activeVariants.length > 0;
  const galleryImages =
    productImages.length > 0
      ? productImages
      : product.image_url
        ? [{ id: product.id, image_url: product.image_url, alt_text: product.name, sort_order: 0, is_cover: true }]
        : [];

  const sizes = Array.from(new Set(activeVariants.map((v) => v.size).filter(Boolean)));
  const colors = Array.from(
    new Map(
      activeVariants
        .filter((v) => v.color)
        .map((v) => [v.color, { name: v.color, hex: v.color_hex }]),
    ).values(),
  );

  const matchVariant = (): Variant | null => {
    if (!hasVariants) return null;
    return (
      activeVariants.find(
        (v) =>
          (sizes.length === 0 || v.size === selectedSize) &&
          (colors.length === 0 || v.color === selectedColor),
      ) ?? null
    );
  };

  const selected = matchVariant();
  const price = effectivePrice(product, selected);
  const stock = effectiveStock(product, selected);
  const needsSize = hasVariants && sizes.length > 0;
  const needsColor = hasVariants && colors.length > 0;
  const canOrderOnWhatsapp = settings && settingBool(settings, "enable_whatsapp");
  const canBuy =
    product.in_stock &&
    stock > 0 &&
    (!hasVariants || Boolean(selected));

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
        <div>
          <div className="hover-zoom aspect-[4/5] overflow-hidden rounded-sm bg-secondary shadow-soft">
            {activeImage || product.image_url ? (
              <img
                src={activeImage || product.image_url}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-8 text-center text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Image coming soon
              </div>
            )}
          </div>
          {galleryImages.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {galleryImages.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setActiveImage(image.image_url)}
                  className={
                    "h-20 w-16 shrink-0 overflow-hidden rounded-sm border bg-secondary " +
                    ((activeImage || product.image_url) === image.image_url ? "border-primary" : "border-border")
                  }
                >
                  <img
                    src={image.image_url}
                    alt={image.alt_text || product.name}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
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
                  const anyStock = activeVariants
                    .filter((v) => v.size === s)
                    .filter((v) => !needsColor || !selectedColor || v.color === selectedColor)
                    .some((v) => v.stock > 0);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setSelectedSize(s);
                        if (selectedColor) {
                          const stillValid = activeVariants.some((v) => v.size === s && v.color === selectedColor && v.stock > 0);
                          if (!stillValid) setSelectedColor(null);
                        }
                      }}
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
                  const anyStock = activeVariants
                    .filter((v) => v.color === c.name)
                    .filter((v) => !needsSize || !selectedSize || v.size === selectedSize)
                    .some((v) => v.stock > 0);
                  return (
                    <button
                      key={c.name}
                      type="button"
                      title={c.name}
                      onClick={() => {
                        setSelectedColor(c.name);
                        if (selectedSize) {
                          const stillValid = activeVariants.some((v) => v.color === c.name && v.size === selectedSize && v.stock > 0);
                          if (!stillValid) setSelectedSize(null);
                        }
                      }}
                      disabled={!anyStock}
                      className={
                        "h-9 w-9 rounded-full border-2 transition-transform " +
                        (active ? "border-primary scale-110" : "border-border") +
                        (!anyStock ? " opacity-40" : "")
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
                  toast.error(
                    needsSize && needsColor
                      ? "Please choose an available size and colour."
                      : needsSize
                        ? "Please choose an available size."
                        : "Please choose an available colour.",
                  );
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
            {canOrderOnWhatsapp && (
              <a
                href={whatsappUrl(
                  settings,
                  `Hi ${settings.store_name}! I'd like to order ${product.name} (${inr(price)}).`,
                )}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-primary/30 px-7 py-3.5 text-xs uppercase tracking-[0.22em] transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <MessageCircle size={15} /> Order on WhatsApp
              </a>
            )}
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
  const [reviewImages, setReviewImages] = useState<File[]>([]);

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
      const imageUrls: string[] = [];
      for (const file of reviewImages.slice(0, 4)) {
        if (!file.type.startsWith("image/")) throw new Error("Review images must be image files.");
        if (file.size > 5 * 1024 * 1024) throw new Error("Review images must be 5MB or smaller.");
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${product.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("review-images")
          .upload(path, file, { cacheControl: "31536000", upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from("review-images").getPublicUrl(path);
        imageUrls.push(data.publicUrl);
      }
      await submit.mutateAsync({
        rating,
        title: title.trim(),
        body: body.trim(),
        images: imageUrls,
        author_name:
          ((user.user_metadata as { full_name?: string } | undefined)?.full_name as string) ||
          user.email?.split("@")[0] ||
          "Customer",
        user_id: user.id,
      });
      setTitle("");
      setBody("");
      setRating(5);
      setReviewImages([]);
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
              {Array.isArray(r.images) && r.images.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {r.images.map((url) => (
                    <img key={url} src={url} alt="" className="aspect-square rounded-sm object-cover" />
                  ))}
                </div>
              )}
              {r.admin_reply && (
                <p className="mt-3 rounded-sm bg-secondary/50 p-3 text-sm">
                  <span className="font-medium">Superb Creations:</span> {r.admin_reply}
                </p>
              )}
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
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  Review images
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setReviewImages(Array.from(e.target.files ?? []).slice(0, 4))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
                />
              </label>
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

      {similarProducts.length > 0 && (
        <section className="mt-16 border-t border-border pt-12">
          <p className="eyebrow">Recommended</p>
          <h2 className="mt-2 font-display text-3xl">Similar pieces</h2>
          <div className="mt-8 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {similarProducts.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
