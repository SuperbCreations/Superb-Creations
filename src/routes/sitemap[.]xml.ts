import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const baseUrl = (requestUrl: string) => {
  const raw = (process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "").replace(
    /\/$/,
    "",
  );
  if (!raw) return new URL(requestUrl).origin;
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
};

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const entries: { path: string; changefreq?: string; priority?: string }[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/shop", changefreq: "daily", priority: "0.9" },
          { path: "/lookbook", changefreq: "weekly", priority: "0.6" },
          { path: "/about", changefreq: "monthly", priority: "0.5" },
          { path: "/contact", changefreq: "monthly", priority: "0.5" },
          { path: "/privacy-policy", changefreq: "yearly", priority: "0.2" },
          { path: "/terms-and-conditions", changefreq: "yearly", priority: "0.2" },
          { path: "/shipping-policy", changefreq: "yearly", priority: "0.2" },
          { path: "/return-refund-policy", changefreq: "yearly", priority: "0.2" },
          { path: "/support-policy", changefreq: "yearly", priority: "0.2" },
        ];

        try {
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } },
          );
          const { data } = await supabase.from("products").select("slug").eq("in_stock", true);
          for (const p of data ?? []) {
            entries.push({ path: `/product/${p.slug}`, changefreq: "weekly", priority: "0.8" });
          }
        } catch {
          /* ignore — still emit static routes */
        }

        const urls = entries
          .map((e) =>
            [
              "  <url>",
              `    <loc>${baseUrl(request.url)}${e.path}</loc>`,
              e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
              e.priority ? `    <priority>${e.priority}</priority>` : null,
              "  </url>",
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n");

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          urls,
          "</urlset>",
        ].join("\n");

        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
