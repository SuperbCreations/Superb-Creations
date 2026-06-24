import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { SITE_GUIDE_EVENT, SITE_GUIDE_STORAGE_KEY } from "@/lib/site-guide";

const steps = [
  {
    title: "Browse Shop",
    body: "Explore active boutique pieces in Shop and open a product for sizes, details, and availability.",
  },
  {
    title: "View Lookbook",
    body: "Use Lookbook for styling inspiration and new collection visuals.",
  },
  {
    title: "Cart & Wishlist",
    body: "Add pieces to your cart, and use wishlist from your account when available.",
  },
  {
    title: "Checkout & Payments",
    body: "Checkout shows the available payment methods, shipping choices, and exact payable amount.",
  },
  {
    title: "Account & Orders",
    body: "Sign in to save addresses, complete your profile, and track order or payment status.",
  },
  {
    title: "Contact Help",
    body: "Use Contact or WhatsApp for sizing, payment, shipping, or order support.",
  },
];

export function SiteGuide() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const disabledRoute =
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/checkout");

  useEffect(() => {
    const openGuide = () => {
      if (disabledRoute) return;
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(SITE_GUIDE_EVENT, openGuide);
    return () => window.removeEventListener(SITE_GUIDE_EVENT, openGuide);
  }, [disabledRoute]);

  useEffect(() => {
    if (disabledRoute) {
      setOpen(false);
      return;
    }
    if (window.localStorage.getItem(SITE_GUIDE_STORAGE_KEY) === "true") return;
    const timer = window.setTimeout(() => setOpen(true), 1200);
    return () => window.clearTimeout(timer);
  }, [disabledRoute]);

  const close = () => {
    window.localStorage.setItem(SITE_GUIDE_STORAGE_KEY, "true");
    setOpen(false);
  };

  if (!open || disabledRoute) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-md rounded-sm border border-border bg-background/95 p-4 shadow-lg backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
            Site guide {step + 1}/{steps.length}
          </p>
          <h2 className="mt-2 font-display text-xl">{current.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{current.body}</p>
        </div>
        <button
          type="button"
          onClick={close}
          className="rounded-full border border-border px-3 py-1 text-xs"
        >
          Skip
        </button>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((value) => Math.max(0, value - 1))}
          className="rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.18em] disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => (isLast ? close() : setStep((value) => value + 1))}
          className="rounded-full bg-primary px-5 py-2 text-xs uppercase tracking-[0.18em] text-primary-foreground"
        >
          {isLast ? "Done" : "Next"}
        </button>
      </div>
    </div>
  );
}
