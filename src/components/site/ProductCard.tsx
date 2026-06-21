import { Link } from "@tanstack/react-router";
import { ShoppingBag, MessageCircle, Star } from "lucide-react";
import { type Product, whatsappOrderLink, inr } from "@/lib/products";
import { useCart } from "@/lib/cart";
import { useAllProductRatings } from "@/lib/reviews";

export function ProductCard({ product }: { product: Product }) {
  const { addItem, setOpen } = useCart();
  const { data: ratings } = useAllProductRatings();
  const rating = ratings?.[product.id];

  const lowStock = product.in_stock && product.stock > 0 && product.stock <= 5;
  const outOfStock = !product.in_stock || product.stock === 0;

  return (
    <article className="group">
      <div className="hover-zoom relative aspect-[4/5] overflow-hidden bg-secondary">
        <Link to="/product/$slug" params={{ slug: product.slug }}>
          <img
            src={product.image_url}
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
            Only {product.stock} left
          </span>
        ) : null}
        <div className="absolute inset-x-3 bottom-3 flex translate-y-2 gap-2 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
          <Link
            to="/product/$slug"
            params={{ slug: product.slug }}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-90"
            onClick={(e) => {
              // Quick-add for products without variants
              if (outOfStock) return;
              e.preventDefault();
              addItem(product);
              setOpen(true);
            }}
          >
            <ShoppingBag size={14} /> {outOfStock ? "Sold out" : "Add"}
          </Link>
          <a
            href={whatsappOrderLink(product)}
            target="_blank"
            rel="noreferrer"
            aria-label="Order on WhatsApp"
            className="inline-flex items-center justify-center rounded-full border border-primary/40 bg-background px-3 py-2.5 text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <MessageCircle size={14} />
          </a>
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
