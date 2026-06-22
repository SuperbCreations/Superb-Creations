import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const siteUrl = (process.env.SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
        const lines = [
          "User-agent: *",
          "Allow: /",
          "Disallow: /admin",
          "Disallow: /account",
          siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml` : "Sitemap: /sitemap.xml",
        ];

        return new Response(lines.join("\n"), {
          headers: {
            "Content-Type": "text/plain",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
