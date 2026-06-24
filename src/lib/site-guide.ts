export const SITE_GUIDE_STORAGE_KEY = "superb-creations-site-guide-complete";
export const SITE_GUIDE_EVENT = "superb-creations:open-site-guide";

export function openSiteGuide() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SITE_GUIDE_EVENT));
}

