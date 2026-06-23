import { Link } from "@tanstack/react-router";
import { Menu, X, ShoppingBag, User, Heart } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { useBusinessSettings } from "@/lib/business-settings";
import { useWishlist } from "@/lib/customer-engagement";
import logo from "@/assets/superb-creations-logo.png";

const nav = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Shop" },
  { to: "/lookbook", label: "Lookbook" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const { count, setOpen: setCartOpen } = useCart();
  const { user, isAdmin } = useAuth();
  const { data: wishlist = [] } = useWishlist(user && !isAdmin ? user.id : undefined);
  const { data: settings } = useBusinessSettings();
  const logoSrc = settings?.logo_url || logo;
  const storeName = settings?.store_name || "Superb Creations";

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="container-boutique flex h-16 items-center justify-between md:h-20">
        <Link to="/" className="flex items-center gap-3">
          <img
            src={logoSrc}
            alt={storeName}
            className="h-11 w-11 rounded-full object-cover md:h-12 md:w-12"
          />
          <span className="font-display text-2xl tracking-tight md:text-3xl">
            {storeName}
          </span>
          <span className="hidden text-[0.6rem] uppercase tracking-[0.32em] text-muted-foreground sm:inline">
            est. boutique
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm tracking-wide text-foreground/80 transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground font-medium" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              to="/admin"
              className="text-sm tracking-wide text-foreground/80 transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              Admin
            </Link>
          )}
          {user && !isAdmin && (
            <Link
              to="/account"
              className="text-sm tracking-wide text-foreground/80 transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              Account
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            to={user ? (isAdmin ? "/admin" : "/account") : "/auth"}
            aria-label="Account"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border transition-colors hover:bg-secondary"
          >
            <User size={17} />
          </Link>
          {user && !isAdmin && (
            <Link
              to="/account"
              aria-label="Wishlist"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border transition-colors hover:bg-secondary"
            >
              <Heart size={17} />
              {wishlist.length > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.6rem] font-medium text-primary-foreground">
                  {wishlist.length}
                </span>
              )}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label="Open bag"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border transition-colors hover:bg-secondary"
          >
            <ShoppingBag size={17} />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.6rem] font-medium text-primary-foreground">
                {count}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border md:hidden"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background md:hidden">
          <nav className="container-boutique flex flex-col gap-1 py-4">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded px-2 py-3 text-sm text-foreground/80"
                activeProps={{ className: "text-foreground font-medium" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="rounded px-2 py-3 text-sm text-foreground/80"
              >
                Admin
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
