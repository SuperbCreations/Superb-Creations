import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { useBlogPost, useBlogPosts } from "@/lib/growth";

export const Route = createFileRoute("/blog/$slug")({
  head: () => ({
    meta: [{ title: "Article — Superb Creations" }],
  }),
  component: BlogArticlePage,
});

function BlogArticlePage() {
  const { slug } = useParams({ from: "/blog/$slug" });
  const { data: post, isLoading } = useBlogPost(slug);
  const { data: posts = [] } = useBlogPosts();
  const related = useMemo(
    () =>
      posts
        .filter((item) => item.id !== post?.id)
        .filter((item) => !post?.category_id || item.category_id === post.category_id)
        .slice(0, 3),
    [post, posts],
  );

  if (isLoading) {
    return (
      <section className="container-boutique py-20">
        <div className="h-8 w-1/2 animate-pulse bg-secondary" />
        <div className="mt-6 aspect-[16/8] animate-pulse bg-secondary" />
      </section>
    );
  }

  if (!post) {
    return (
      <section className="container-boutique py-20 text-center">
        <h1 className="font-display text-4xl">Article not found.</h1>
        <Link to="/blog" className="mt-5 inline-block underline">Back to blog</Link>
      </section>
    );
  }

  return (
    <article className="container-boutique py-16 md:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <p className="eyebrow">
          {post.blog_categories?.name ?? "Journal"} · {post.reading_minutes} min read
        </p>
        <h1 className="mt-4 font-display text-5xl leading-tight md:text-6xl">{post.title}</h1>
        {post.excerpt && <p className="mt-5 text-muted-foreground">{post.excerpt}</p>}
      </div>

      {post.banner_image_url && (
        <div className="mt-12 aspect-[16/8] overflow-hidden bg-secondary">
          <img src={post.banner_image_url} alt={post.title} className="h-full w-full object-cover" />
        </div>
      )}

      <div className="prose prose-neutral mx-auto mt-12 max-w-3xl whitespace-pre-line text-sm leading-7 text-foreground">
        {post.content}
      </div>

      {related.length > 0 && (
        <section className="mt-20 border-t border-border pt-12">
          <h2 className="font-display text-3xl">Related posts</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {related.map((item) => (
              <Link key={item.id} to="/blog/$slug" params={{ slug: item.slug }}>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {item.blog_categories?.name ?? "Journal"}
                </p>
                <h3 className="mt-2 font-display text-2xl">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
