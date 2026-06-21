import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: { path: string; changefreq?: string; priority?: string }[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/shop", changefreq: "daily", priority: "0.9" },
          { path: "/lookbook", changefreq: "weekly", priority: "0.6" },
          { path: "/about", changefreq: "monthly", priority: "0.5" },
          { path: "/contact", changefreq: "monthly", priority: "0.5" },
        ];

        try {
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } },
          );
          const { data } = await supabase.from("products").select("slug");
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
              `    <loc>${BASE_URL}${e.path}</loc>`,
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
