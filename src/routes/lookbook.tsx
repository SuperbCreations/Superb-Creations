import { createFileRoute } from "@tanstack/react-router";
import hero from "@/assets/hero-1.jpg";
import look from "@/assets/lookbook-1.jpg";
import p1 from "@/assets/product-1.jpg";
import p2 from "@/assets/product-2.jpg";
import p3 from "@/assets/product-3.jpg";
import p4 from "@/assets/product-4.jpg";
import collection from "@/assets/collection-1.jpg";

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
        <figure className="hover-zoom md:col-span-7 aspect-[4/5] overflow-hidden">
          <img src={hero} alt="" loading="lazy" className="h-full w-full object-cover" />
        </figure>
        <figure className="hover-zoom md:col-span-5 aspect-[4/5] overflow-hidden md:mt-24">
          <img src={look} alt="" loading="lazy" className="h-full w-full object-cover" />
        </figure>
        <figure className="hover-zoom md:col-span-4 aspect-[4/5] overflow-hidden">
          <img src={p1} alt="" loading="lazy" className="h-full w-full object-cover" />
        </figure>
        <figure className="hover-zoom md:col-span-4 aspect-[4/5] overflow-hidden md:mt-16">
          <img src={p2} alt="" loading="lazy" className="h-full w-full object-cover" />
        </figure>
        <figure className="hover-zoom md:col-span-4 aspect-[4/5] overflow-hidden">
          <img src={p3} alt="" loading="lazy" className="h-full w-full object-cover" />
        </figure>
        <figure className="hover-zoom md:col-span-6 aspect-[5/4] overflow-hidden">
          <img src={collection} alt="" loading="lazy" className="h-full w-full object-cover" />
        </figure>
        <figure className="hover-zoom md:col-span-6 aspect-[5/4] overflow-hidden md:mt-12">
          <img src={p4} alt="" loading="lazy" className="h-full w-full object-cover" />
        </figure>
      </section>
    </>
  );
}
