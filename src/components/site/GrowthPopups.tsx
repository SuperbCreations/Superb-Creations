import { useEffect, useMemo, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { X } from "lucide-react";
import { settingBool, useBusinessSettings } from "@/lib/business-settings";
import { useMarketingPopups, useRecordPopupEvent } from "@/lib/growth";

const dismissedKey = (id: string) => `sc_popup_dismissed_${id}`;

export function GrowthPopups() {
  const location = useLocation();
  const { settings } = useBusinessSettings();
  const enabled = settingBool(settings, "enable_marketing_popups");
  const { data: popups = [] } = useMarketingPopups(location.pathname);
  const record = useRecordPopupEvent();
  const popup = useMemo(() => popups[0], [popups]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled || !popup || typeof window === "undefined") return;
    if (popup.frequency !== "always" && window.sessionStorage.getItem(dismissedKey(popup.id))) {
      return;
    }
    const timer = window.setTimeout(() => {
      setOpen(true);
      record.mutate({
        popupId: popup.id,
        eventType: "impression",
        path: location.pathname,
      });
    }, popup.popup_type === "welcome" ? 1200 : 2500);
    return () => window.clearTimeout(timer);
  }, [enabled, location.pathname, popup, record]);

  if (!enabled || !popup || !open) return null;

  const close = () => {
    setOpen(false);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(dismissedKey(popup.id), "true");
    }
    record.mutate({ popupId: popup.id, eventType: "dismiss", path: location.pathname });
  };

  const cta = popup.cta_url ? (
    <a
      href={popup.cta_url}
      onClick={() => record.mutate({ popupId: popup.id, eventType: "click", path: location.pathname })}
      className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground"
    >
      {popup.cta_label || "Shop now"}
    </a>
  ) : null;

  return (
    <div className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-md rounded-sm border border-border bg-background p-5 shadow-soft">
      <button
        type="button"
        onClick={close}
        aria-label="Dismiss"
        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border"
      >
        <X size={14} />
      </button>
      {popup.image_url && (
        <img
          src={popup.image_url}
          alt=""
          className="mb-4 aspect-[16/9] w-full rounded-sm object-cover"
          loading="lazy"
        />
      )}
      <p className="eyebrow">{popup.popup_type.replaceAll("_", " ")}</p>
      <h2 className="mt-2 font-display text-2xl">{popup.title}</h2>
      {popup.body && <p className="mt-2 text-sm leading-6 text-muted-foreground">{popup.body}</p>}
      {popup.coupon_code && (
        <p className="mt-4 inline-flex rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.18em]">
          {popup.coupon_code}
        </p>
      )}
      {cta}
    </div>
  );
}
