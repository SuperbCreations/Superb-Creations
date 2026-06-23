import { createFileRoute, Link } from "@tanstack/react-router";
import { useLookbookItems } from "@/lib/lookbook";
import placeholderAbout from "@/assets/lookbook-1.jpg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "Our Story — Superb Creations" },
      {
        name: "description",
        content:
          "Superb Creations is a small Indian women's wear boutique built on craftsmanship, soft palettes and slow making.",
      },
      { property: "og:title", content: "Our Story — Superb Creations" },
      { property: "og:description", content: "A boutique built on craft, calm and intention." },
    ],
  }),
  component: About,
});

function About() {
  const { data: lookbookItems = [] } = useLookbookItems();
  const aboutImage = lookbookItems[0];

  return (
    <>
      <section className="container-boutique grid gap-12 py-20 md:grid-cols-2 md:py-28">
        <div>
          <p className="eyebrow">Our Story</p>
          <h1 className="mt-3 font-display text-5xl leading-tight md:text-6xl">
            A boutique built on quiet craft.
          </h1>
          <div className="mt-8 space-y-5 text-base leading-relaxed text-muted-foreground">
            <p>
              Superb Creations began as a small studio with one belief — that the
              clothes you wear most often deserve the most care. We design and
              hand-finish small collections of women's wear, paired with a curated
              edit of beauty essentials.
            </p>
            <p>
              Every kurta, dress and saree is made in limited batches by skilled
              artisans across India. We work with breathable fabrics, soft palettes
              and timeless silhouettes — pieces meant to stay in your wardrobe for
              years, not seasons.
            </p>
            <p>
              We're a small team. When you order from us, you're often speaking to
              the same people who packed your parcel.
            </p>
          </div>
          <Link
            to="/shop"
            className="mt-10 inline-flex items-center rounded-full bg-primary px-6 py-3 text-xs uppercase tracking-[0.22em] text-primary-foreground hover:opacity-90"
          >
            Shop the collection
          </Link>
        </div>
        <div className="hover-zoom aspect-[4/5] overflow-hidden">
          {aboutImage ? (
            <img
              src={aboutImage.image_url}
              alt={aboutImage.title || "Superb Creations story"}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <img
              src={placeholderAbout}
              alt="Superb Creations boutique placeholder"
              loading="lazy"
              className="h-full w-full object-cover"
            />
          )}
        </div>
      </section>

      <section className="bg-blush">
        <div className="container-boutique grid gap-10 py-16 md:grid-cols-3">
          {[
            { n: "200+", l: "Happy customers across India" },
            { n: "15", l: "Artisan partners we work with" },
            { n: "100%", l: "Hand-finished, made in India" },
          ].map((s) => (
            <div key={s.l}>
              <p className="font-display text-5xl">{s.n}</p>
              <p className="mt-2 text-sm uppercase tracking-[0.2em] text-muted-foreground">
                {s.l}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
