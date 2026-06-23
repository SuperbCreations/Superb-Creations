import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Linkedin, Youtube, Globe } from "lucide-react";
import { settingBool, useBusinessSettings } from "@/lib/business-settings";

export function Footer() {
  const { data: settings } = useBusinessSettings();
  const s = settings;
  const socials = s
    ? [
        { key: "instagram", show: settingBool(s, "show_instagram"), href: s.instagram_url, icon: Instagram },
        { key: "youtube", show: settingBool(s, "show_youtube"), href: s.youtube_url, icon: Youtube },
        { key: "facebook", show: settingBool(s, "show_facebook"), href: s.facebook_url, icon: Facebook },
        { key: "linkedin", show: settingBool(s, "show_linkedin"), href: s.linkedin_url, icon: Linkedin },
        { key: "website", show: settingBool(s, "show_website"), href: s.website_url, icon: Globe },
      ]
    : [];

  return (
    <footer className="mt-24 border-t border-border bg-secondary/40">
      <div className="container-boutique grid gap-12 py-16 md:grid-cols-4">
        <div className="md:col-span-2">
          <h3 className="font-display text-3xl">{s?.store_name || "Superb Creations"}</h3>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {s?.website_description ||
              "Quietly elegant women's wear and beauty essentials — designed for every day, made to be lived in."}
          </p>
          <div className="mt-6 flex gap-3">
            {socials
              .filter((item) => item.show && item.href)
              .map(({ key, href, icon: Icon }) => (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={key}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <Icon size={16} />
                </a>
              ))}
          </div>
        </div>

        <div>
          <p className="eyebrow">Shop</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link to="/shop" className="hover:underline">All pieces</Link></li>
            <li><Link to="/lookbook" className="hover:underline">Lookbook</Link></li>
            <li><Link to="/about" className="hover:underline">Our story</Link></li>
            <li><Link to="/contact" className="hover:underline">Contact</Link></li>
          </ul>
        </div>

        <div>
          <p className="eyebrow">Order &amp; Care</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>WhatsApp: {s?.phone_number || "+91 70062 02496"}</li>
            <li>{s?.business_hours || "Mon-Sat, 10am-7pm"}</li>
            <li>{s?.estimated_delivery || "Ships across India"}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-boutique flex flex-col items-center justify-between gap-4 py-6 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} {s?.copyright_text || "Superb Creations. All rights reserved."}</p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            <Link to="/privacy-policy" className="hover:underline">Privacy</Link>
            <Link to="/terms-and-conditions" className="hover:underline">Terms</Link>
            <Link to="/shipping-policy" className="hover:underline">Shipping</Link>
            <Link to="/return-refund-policy" className="hover:underline">Returns</Link>
            <Link to="/support-policy" className="hover:underline">Support</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
