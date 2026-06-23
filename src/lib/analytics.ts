import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AnalyticsEventType =
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "remove_from_cart"
  | "wishlist_add"
  | "wishlist_remove"
  | "checkout_started"
  | "coupon_applied"
  | "payment_started"
  | "payment_submitted"
  | "order_placed"
  | "search_query"
  | "filter_usage"
  | "newsletter_signup"
  | "review_submitted";

const SESSION_KEY = "sc_analytics_session";

function getSessionId() {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const next = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return "";
  }
}

function cleanMetadata(metadata: Record<string, unknown> = {}) {
  const allowed = Object.entries(metadata).filter(([key, value]) => {
    if (["email", "phone", "address", "name", "utr", "payment_utr"].includes(key.toLowerCase())) {
      return false;
    }
    return ["string", "number", "boolean"].includes(typeof value) || value == null;
  });
  return Object.fromEntries(allowed.slice(0, 20));
}

export async function trackAnalyticsEvent({
  eventType,
  productId,
  userId,
  metadata,
}: {
  eventType: AnalyticsEventType;
  productId?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (typeof window === "undefined") return;
  const payload = {
    event_type: eventType,
    path: window.location.pathname,
    product_id: productId || null,
    user_id: userId || null,
    session_id: getSessionId() || null,
    metadata: cleanMetadata(metadata),
  };
  const { error } = await supabase.from("analytics_events").insert(payload);
  if (error && import.meta.env.DEV) {
    console.warn("[analytics] event not recorded", error.message);
  }
}

export function usePageAnalytics(userId?: string | null, pathKey?: string) {
  useEffect(() => {
    trackAnalyticsEvent({
      eventType: "page_view",
      userId,
      metadata: { title: document.title },
    });
  }, [pathKey, userId]);
}
