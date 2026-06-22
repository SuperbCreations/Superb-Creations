import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, Sparkles, Truck, Heart } from "lucide-react";
import heroImg from "@/assets/hero-1.jpg";
import collectionImg from "@/assets/collection-1.jpg";
import cosmeticsImg from "@/assets/cosmetics.jpg";
import { useProducts, whatsappLink } from "@/lib/products";
import { useLookbookItems } from "@/lib/lookbook";
import { ProductCard } from "@/components/site/ProductCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Superb Creations — Women's Clothing & Beauty Boutique" },
      {
        name: "description",
        content:
          "Discover Superb Creations: handcrafted kurta sets, dresses, sarees and beauty essentials. Order on WhatsApp or explore the collection online.",
      },
      { property: "og:title", content: "Superb Creations — Women's Boutique" },
      {
        property: "og:description",
        content: "Quietly elegant women's wear, lovingly made in India.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { data: products = [] } = useProducts();
  const { data: lookbookItems = [] } = useLookbookItems();
  const featured = products.slice(0, 4);
  const lookbookPreview = lookbookItems[0];

  return (
    <>
      <section className="relative overflow-hidden bg-blush">
        <div className="container-boutique grid items-center gap-10 py-12 md:grid-cols-[1.05fr_1fr] md:gap-16 md:py-20">
          <div className="fade-up max-w-xl">
            <p className="eyebrow">New season · Spring edit</p>
            <h1 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight text-foreground md:text-7xl">
              Quietly elegant.<br />
              <span className="italic text-foreground/80">Made for every day.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
              Hand-finished kurta sets, flowy silhouettes and timeless drapes — designed
              in soft pastels for the modern Indian wardrobe.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/shop"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-xs uppercase tracking-[0.22em] text-primary-foreground transition-opacity hover:opacity-90"
              >
                Shop the edit <ArrowRight size={14} />
              </Link>
              <a
                href={whatsappLink("Hi! I'd like to place an order with Superb Creations.")}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-primary/30 px-6 py-3 text-xs uppercase tracking-[0.22em] text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <MessageCircle size={14} /> Order on WhatsApp
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="hover-zoom aspect-[3/4] overflow-hidden rounded-sm shadow-soft">
              <img
                src={heroImg}
                alt="Model wearing a soft pink embroidered kurta from Superb Creations"
                width={1600}
                height={1920}
                className="h-full w-full object-cover"
                fetchPriority="high"
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden border-y border-primary/10 bg-background/40 py-4">
          <div className="marquee text-sm uppercase tracking-[0.32em] text-foreground/70">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex shrink-0 gap-12">
                <span>Free shipping over ₹2,500</span>
                <span>✦</span>
                <span>Order on WhatsApp · +91 70062 02496</span>
                <span>✦</span>
                <span>Handcrafted in India</span>
                <span>✦</span>
                <span>New drops every Friday</span>
                <span>✦</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-boutique py-20 md:py-28">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="eyebrow">The Edit</p>
            <h2 className="mt-2 font-display text-4xl md:text-5xl">Pieces we love right now</h2>
          </div>
          <Link
            to="/shop"
            className="hidden text-sm uppercase tracking-[0.22em] underline-offset-4 hover:underline md:inline"
          >
            View all →
          </Link>
        </div>
        <div className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        {featured.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            No products available yet.
          </p>
        )}
      </section>

      <section className="container-boutique grid gap-6 pb-24 md:grid-cols-2">
        <Link to="/shop" className="hover-zoom group relative aspect-[5/6] overflow-hidden bg-secondary">
          <img
            src={collectionImg}
            alt="Curated everyday wear collection"
            loading="lazy"
            width={1200}
            height={1500}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/40 to-transparent p-8">
            <div className="text-background">
              <p className="text-[0.65rem] uppercase tracking-[0.3em]">Clothing</p>
              <h3 className="font-display text-3xl md:text-4xl">Everyday Essentials</h3>
              <p className="mt-2 text-sm opacity-90">Soft, breathable, beautifully made.</p>
            </div>
          </div>
        </Link>
        <Link to="/shop" className="hover-zoom group relative aspect-[5/6] overflow-hidden bg-secondary">
          <img
            src={cosmeticsImg}
            alt="Curated beauty essentials"
            loading="lazy"
            width={1200}
            height={1500}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/40 to-transparent p-8">
            <div className="text-background">
              <p className="text-[0.65rem] uppercase tracking-[0.3em]">Beauty</p>
              <h3 className="font-display text-3xl md:text-4xl">Cosmetics &amp; Care</h3>
              <p className="mt-2 text-sm opacity-90">Quiet luxuries for everyday rituals.</p>
            </div>
          </div>
        </Link>
      </section>

      <section className="bg-secondary/50">
        <div className="container-boutique grid items-center gap-12 py-20 md:grid-cols-2 md:py-28">
          <div className="hover-zoom order-2 aspect-[4/5] overflow-hidden md:order-1">
            {lookbookPreview ? (
              <img
                src={lookbookPreview.image_url}
                alt={lookbookPreview.title || "Lookbook editorial photograph"}
                loading="lazy"
                width={1200}
                height={1500}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-secondary" />
            )}
          </div>
          <div className="order-1 md:order-2 md:pl-8">
            <p className="eyebrow">Lookbook · Vol. 01</p>
            <h2 className="mt-3 font-display text-4xl md:text-5xl">
              An ode to soft mornings.
            </h2>
            <p className="mt-5 max-w-md text-muted-foreground">
              Our spring lookbook celebrates ease — the kind of pieces you pull
              on without thinking, that quietly turn heads anyway.
            </p>
            <Link
              to="/lookbook"
              className="mt-8 inline-flex items-center gap-2 text-sm uppercase tracking-[0.22em] underline-offset-4 hover:underline"
            >
              View the lookbook <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      <section className="container-boutique grid gap-10 py-20 md:grid-cols-3 md:py-24">
        {[
          { icon: Sparkles, title: "Handcrafted detail", body: "Every piece carries the mark of skilled artisans across India." },
          { icon: Truck, title: "Pan-India delivery", body: "Free shipping on orders above ₹2,500. Easy WhatsApp returns." },
          { icon: Heart, title: "Made with intention", body: "Small batches, thoughtful fabrics, designed to be loved for years." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title}>
            <Icon size={22} className="text-foreground/70" />
            <h3 className="mt-4 font-display text-xl">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </>
  );
}
