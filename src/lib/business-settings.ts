import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_BUSINESS_SETTINGS = {
  store_name: "Superb Creations",
  business_name: "Superb Creations",
  logo_url: "",
  favicon_url: "",
  primary_color: "#b07a86",
  secondary_color: "#f7e8e8",
  website_title: "Superb Creations — Quietly Elegant Women's Wear",
  website_description:
    "Superb Creations is a women's clothing and beauty boutique — handcrafted kurta sets, dresses, sarees and cosmetics. Order on WhatsApp.",
  copyright_text: "Superb Creations. All rights reserved.",
  store_status: "open",
  maintenance_mode: "false",
  maintenance_message: "We are refreshing the store. Please check back soon.",
  enable_checkout: "true",
  enable_orders: "true",
  enable_whatsapp: "true",
  enable_upi: "true",
  enable_razorpay: "false",
  enable_cod: "false",
  enable_reviews: "true",
  enable_wishlist: "false",
  enable_newsletter: "false",
  enable_email_sending: "false",
  brevo_contacts_enabled: "false",
  contact_email: "superbcreations55@gmail.com",
  support_email: "superbcreations55@gmail.com",
  business_email: "superbcreations55@gmail.com",
  phone_number: "+91 70062 02496",
  whatsapp_number: "917006202496",
  address: "Studio, India",
  city: "",
  state: "",
  country: "India",
  pincode: "",
  google_maps_link: "",
  business_hours: "Mon-Sat, 10am-7pm",
  emergency_contact: "",
  instagram_url:
    "https://www.instagram.com/superb_creations_?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==",
  facebook_url: "https://www.facebook.com/share/1U22A7sHpi/?mibextid=wwXIfr",
  youtube_url: "https://youtube.com/@superb_creations?si=8gHDjFUhjRMpktts",
  pinterest_url: "",
  x_url: "",
  linkedin_url: "",
  threads_url: "",
  website_url: "",
  show_instagram: "true",
  show_facebook: "true",
  show_youtube: "true",
  show_pinterest: "false",
  show_x: "false",
  show_linkedin: "false",
  show_threads: "false",
  show_website: "false",
  hero_eyebrow: "New season · Spring edit",
  hero_title: "Quietly elegant.",
  hero_subtitle: "Made for every day.",
  hero_description:
    "Hand-finished kurta sets, flowy silhouettes and timeless drapes — designed in soft pastels for the modern Indian wardrobe.",
  hero_button_text: "Shop the edit",
  hero_button_link: "/shop",
  announcement_bar:
    "Free shipping over ₹2,500 ✦ Order on WhatsApp · +91 70062 02496 ✦ Handcrafted in India ✦ New drops every Friday",
  announcement_color: "#ffffff66",
  homepage_banner_url: "",
  featured_collection_title: "Pieces we love right now",
  featured_collection_description: "",
  lookbook_title: "An ode to soft mornings.",
  lookbook_description:
    "Our spring lookbook celebrates ease — the kind of pieces you pull on without thinking, that quietly turn heads anyway.",
  flat_shipping: "99",
  free_shipping_threshold: "2500",
  express_shipping: "false",
  express_shipping_fee: "199",
  default_shipping_provider: "manual",
  shipping_mode: "manual",
  enable_shiprocket: "false",
  enable_delhivery: "false",
  enable_india_post: "false",
  enable_blue_dart: "false",
  shipping_insurance: "false",
  estimated_delivery_days: "3-7",
  pickup_address: "",
  return_address: "",
  shipping_support_contact: "superbcreations55@gmail.com",
  shiprocket_api_key: "",
  delhivery_api_key: "",
  blue_dart_api_key: "",
  india_post_customer_id: "",
  estimated_delivery: "3-7 business days",
  international_shipping: "false",
  cod_available: "false",
  packaging_charge: "0",
  tax_percentage: "0",
  upi_id: "9205245555@axl",
  merchant_name: "Superb Creations",
  payment_note: "Superb Creations order",
  payment_timeout_minutes: "30",
  privacy_policy: "",
  shipping_policy: "",
  return_refund_policy: "",
  terms_policy: "",
  support_policy: "",
  seo_keywords: "women clothing, boutique, kurta sets, sarees, dresses, cosmetics",
  og_image_url: "",
  twitter_image_url: "",
  robots_index: "true",
  google_verification_code: "",
  google_analytics_id: "",
  meta_pixel_id: "",
  canonical_url: "",
  email_sender_name: "Superb Creations",
  email_sender_email: "",
  email_reply_to: "",
  brevo_api_key: "",
  email_company_address: "",
  email_footer: "Thank you for shopping with Superb Creations.",
  email_logo_url: "",
  email_primary_color: "#b07a86",
  email_secondary_color: "#f7e8e8",
  max_upload_size_mb: "5",
} as const;

export type BusinessSettings = Record<keyof typeof DEFAULT_BUSINESS_SETTINGS, string>;
export type BusinessSettingKey = keyof BusinessSettings;

export const settingBool = (settings: BusinessSettings, key: BusinessSettingKey) =>
  settings[key] === "true";

export const settingNumber = (settings: BusinessSettings, key: BusinessSettingKey) => {
  const n = Number(settings[key]);
  return Number.isFinite(n) ? n : Number(DEFAULT_BUSINESS_SETTINGS[key] || 0);
};

const SECRET_SETTING_PATTERN = /(api_key|secret|token|password|service_role|private)/i;

export async function fetchBusinessSettings(): Promise<BusinessSettings> {
  const { data, error } = await supabase.from("business_settings").select("key,value");
  if (error) throw error;

  return (data ?? []).reduce(
    (settings, row) =>
      row.key in settings && !SECRET_SETTING_PATTERN.test(row.key)
        ? { ...settings, [row.key]: row.value }
        : settings,
    { ...DEFAULT_BUSINESS_SETTINGS } as BusinessSettings,
  );
}

export function useBusinessSettings() {
  return useQuery({
    queryKey: ["business-settings"],
    queryFn: fetchBusinessSettings,
    staleTime: 60_000,
  });
}

export function businessSettingRows(settings: Partial<BusinessSettings>) {
  return Object.entries(settings)
    .filter(
      ([key, value]) =>
        !SECRET_SETTING_PATTERN.test(key) || Boolean(value),
    )
    .map(([key, value]) => ({ key, value: value ?? "" }));
}

export function whatsappUrl(settings: BusinessSettings, message: string) {
  return `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(message)}`;
}
