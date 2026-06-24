import { Link } from "@tanstack/react-router";
import { ShoppingBag, MessageCircle, Star, Heart } from "lucide-react";
import { type Product, inr, useAllVariants } from "@/lib/products";
import { useCart } from "@/lib/cart";
import { useAllProductRatings } from "@/lib/reviews";
import { settingBool, useBusinessSettings, whatsappUrl } from "@/lib/business-settings";
import { useAuth } from "@/lib/auth";
import { useToggleWishlist, useWishlist } from "@/lib/customer-engagement";

export function ProductCard({ product }: { product: Product }) {
  const { addItem, setOpen } = useCart();
  const { user } = useAuth();
  const { data: ratings } = useAllProductRatings();
  const { data: allVariants = [] } = useAllVariants();
  const { settings } = useBusinessSettings();
  const { data: wishlist = [] } = useWishlist(user?.id);
  const toggleWishlist = useToggleWishlist(user?.id);
  const rating = ratings?.[product.id];
  const canOrderOnWhatsapp = settings && settingBool(settings, "enable_whatsapp");
  const wished = wishlist.some((item) => item.product_id === product.id);

  const variants = allVariants.filter((variant) => variant.product_id === product.id);
  const hasVariants = variants.length > 0;
  const variantStock = variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock || 0)), 0);
  const availableStock = hasVariants ? variantStock : product.stock;
  const lowStock = product.in_stock && availableStock > 0 && availableStock <= 5;
  const outOfStock = !product.in_stock || availableStock === 0;
  const coverImage = product.cover_image_url || product.image_url;

  return (
    <article className="group">
      <div className="hover-zoom relative aspect-[4/5] overflow-hidden bg-secondary">
        <Link to="/product/$slug" params={{ slug: product.slug }}>
          <img
            src={coverImage}
            alt={product.name}
            loading="lazy"
            width={1000}
            height={1300}
            className="h-full w-full object-cover"
          />
        </Link>
        {product.tag && (
          <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em]">
            {product.tag}
          </span>
        )}
        {outOfStock ? (
          <span className="absolute right-3 top-3 rounded-full bg-foreground/80 px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-background">
            Sold out
          </span>
        ) : lowStock ? (
          <span className="absolute right-3 top-3 rounded-full bg-primary/90 px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-primary-foreground">
            Only {availableStock} left
          </span>
        ) : null}
        {user && (
          <button
            type="button"
            onClick={() => toggleWishlist.mutate({ productId: product.id, wished })}
            aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
            className="absolute left-3 bottom-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-soft"
          >
            <Heart size={15} className={wished ? "fill-primary text-primary" : ""} />
          </button>
        )}
        <div className="absolute inset-x-3 bottom-3 flex translate-y-2 gap-2 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
          <Link
            to="/product/$slug"
            params={{ slug: product.slug }}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-90"
            onClick={(e) => {
              if (outOfStock || hasVariants) return;
              e.preventDefault();
              addItem(product);
              setOpen(true);
            }}
          >
            <ShoppingBag size={14} /> {outOfStock ? "Sold out" : hasVariants ? "Select" : "Add"}
          </Link>
          {canOrderOnWhatsapp && (
            <a
              href={whatsappUrl(
                settings,
                `Hi ${settings.store_name}! I'd like to order ${product.name} (${inr(product.price)}).`,
              )}
              target="_blank"
              rel="noreferrer"
              aria-label="Order on WhatsApp"
              className="inline-flex items-center justify-center rounded-full border border-primary/40 bg-background px-3 py-2.5 text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <MessageCircle size={14} />
            </a>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
            {product.category}
          </p>
          <h3 className="mt-1 font-display text-lg leading-snug">
            <Link to="/product/$slug" params={{ slug: product.slug }}>
              {product.name}
            </Link>
          </h3>
          {rating && rating.count > 0 && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Star size={12} className="fill-primary text-primary" />
              {rating.avg.toFixed(1)} ({rating.count})
            </p>
          )}
        </div>
        <p className="font-display text-lg">{inr(product.price)}</p>
      </div>
    </article>
  );
}
