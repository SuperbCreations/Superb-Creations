import { createFileRoute } from "@tanstack/react-router";
import hero from "@/assets/hero-1.jpg";
import { useLookbookItems } from "@/lib/lookbook";

export const Route = createFileRoute("/lookbook")({
  head: () => ({
    meta: [
      { title: "Lookbook — Superb Creations" },
      {
        name: "description",
        content:
          "Editorial imagery from Superb Creations — soft pastels, gentle silhouettes, made for the everyday.",
      },
      { property: "og:title", content: "Lookbook — Superb Creations" },
      { property: "og:description", content: "Spring volume one. A study in softness." },
      { property: "og:image", content: hero },
    ],
  }),
  component: Lookbook,
});

function Lookbook() {
  const { data: items = [], isLoading } = useLookbookItems();

  return (
    <>
      <section className="container-boutique py-16 md:py-24">
        <p className="eyebrow">Lookbook · Vol. 01</p>
        <h1 className="mt-3 max-w-2xl font-display text-5xl leading-tight md:text-7xl">
          A study in softness.
        </h1>
        <p className="mt-6 max-w-xl text-muted-foreground">
          Captured in natural light. Worn slowly, lived in fully.
        </p>
      </section>

      <section className="container-boutique grid gap-6 pb-24 md:grid-cols-12">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={
                "animate-pulse bg-secondary " +
                (i < 2 ? "aspect-[4/5] md:col-span-6" : "aspect-[5/4] md:col-span-4")
              }
            />
          ))}

        {!isLoading &&
          items.map((item, i) => (
            <figure
              key={item.id}
              className={
                (i % 5 === 0
                  ? "md:col-span-7"
                  : i % 5 === 1
                    ? "md:col-span-5 md:mt-24"
                    : i % 5 === 2
                      ? "md:col-span-4"
                      : i % 5 === 3
                        ? "md:col-span-4 md:mt-16"
                        : "md:col-span-6")
              }
            >
              <div
                className={
                  "hover-zoom overflow-hidden " + (i % 5 === 4 ? "aspect-[5/4]" : "aspect-[4/5]")
                }
              >
                <img
                  src={item.image_url}
                  alt={item.title || item.caption || "Superb Creations lookbook image"}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              {(item.title || item.caption) && (
                <figcaption className="mt-3 text-sm text-muted-foreground">
                  {item.title && <span className="font-medium text-foreground">{item.title}</span>}
                  {item.title && item.caption && " · "}
                  {item.caption}
                </figcaption>
              )}
            </figure>
          ))}

        {!isLoading && items.length === 0 && (
          <p className="md:col-span-12 text-center text-sm text-muted-foreground">
            No lookbook images available yet.
          </p>
        )}
      </section>
    </>
  );
}
