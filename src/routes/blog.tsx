import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { settingBool, useBusinessSettings } from "@/lib/business-settings";
import { useBlogCategories, useBlogPosts } from "@/lib/growth";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Blog — Superb Creations" },
      {
        name: "description",
        content: "Style notes, boutique updates and care guides from Superb Creations.",
      },
      { property: "og:title", content: "Blog — Superb Creations" },
      { property: "og:description", content: "Style notes and boutique updates." },
    ],
  }),
  component: BlogPage,
});

function BlogPage() {
  const { settings } = useBusinessSettings();
  const enabled = settingBool(settings, "enable_blog");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const { data: categories = [] } = useBlogCategories();
  const { data: posts = [], isLoading } = useBlogPosts({ search, category });
  const featured = useMemo(() => posts.find((post) => post.featured) ?? posts[0], [posts]);
  const rest = featured ? posts.filter((post) => post.id !== featured.id) : posts;

  if (!enabled) {
    return (
      <section className="container-boutique py-20 text-center">
        <h1 className="font-display text-4xl">Blog is coming soon.</h1>
      </section>
    );
  }

  return (
    <section className="container-boutique py-16 md:py-24">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Journal</p>
          <h1 className="mt-3 font-display text-5xl md:text-6xl">Style notes.</h1>
        </div>
        <label className="flex min-w-64 items-center gap-2 border-b border-border py-2">
          <Search size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search articles"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory("")}
          className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.16em] ${!category ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
        >
          All
        </button>
        {categories.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCategory(item.slug)}
            className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.16em] ${category === item.slug ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
          >
            {item.name}
          </button>
        ))}
      </div>

      {isLoading && <p className="mt-12 text-sm text-muted-foreground">Loading articles...</p>}

      {!isLoading && featured && (
        <Link to="/blog/$slug" params={{ slug: featured.slug }} className="mt-12 grid gap-8 md:grid-cols-[1fr_0.9fr]">
          <div className="aspect-[16/10] overflow-hidden bg-secondary">
            {featured.banner_image_url ? (
              <img src={featured.banner_image_url} alt={featured.title} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="self-center">
            <p className="eyebrow">Featured</p>
            <h2 className="mt-3 font-display text-4xl">{featured.title}</h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{featured.excerpt}</p>
            <p className="mt-5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {featured.reading_minutes} min read
            </p>
          </div>
        </Link>
      )}

      <div className="mt-14 grid gap-8 md:grid-cols-3">
        {rest.map((post) => (
          <Link key={post.id} to="/blog/$slug" params={{ slug: post.slug }} className="group">
            <div className="aspect-[4/3] overflow-hidden bg-secondary">
              {post.banner_image_url ? (
                <img src={post.banner_image_url} alt={post.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : null}
            </div>
            <p className="mt-5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {post.blog_categories?.name ?? "Journal"} · {post.reading_minutes} min
            </p>
            <h3 className="mt-2 font-display text-2xl">{post.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{post.excerpt}</p>
          </Link>
        ))}
      </div>

      {!isLoading && posts.length === 0 && (
        <p className="mt-12 text-center text-sm text-muted-foreground">No articles published yet.</p>
      )}
    </section>
  );
}
