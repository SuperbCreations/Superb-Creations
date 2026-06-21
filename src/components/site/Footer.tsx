import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Youtube } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-secondary/40">
      <div className="container-boutique grid gap-12 py-16 md:grid-cols-4">
        <div className="md:col-span-2">
          <h3 className="font-display text-3xl">Superb Creations</h3>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Quietly elegant women's wear and beauty essentials — designed for
            every day, made to be lived in.
          </p>
          <div className="mt-6 flex gap-3">
            <a
              href="https://www.instagram.com/superb_creations_?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <Instagram size={16} />
            </a>
            <a
              href="https://youtube.com/@superb_creations?si=8gHDjFUhjRMpktts"
              target="_blank"
              rel="noreferrer"
              aria-label="YouTube"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <Youtube size={16} />
            </a>
            <a
              href="https://www.facebook.com/share/1U22A7sHpi/?mibextid=wwXIfr"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <Facebook size={16} />
            </a>
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
            <li>WhatsApp: +91 70062 02496</li>
            <li>Mon–Sat · 10am–7pm</li>
            <li>Ships across India</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-boutique flex flex-col items-center justify-between gap-3 py-6 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} Superb Creations. All rights reserved.</p>
          <p>Handcrafted in India.</p>
        </div>
      </div>
    </footer>
  );
}
