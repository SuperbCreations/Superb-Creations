import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  publicSupabase,
  publicSupabaseProjectRef,
} from "@/integrations/supabase/public-client";
import { useAuth } from "@/lib/auth";

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
  enable_loyalty: "true",
  enable_referrals: "true",
  enable_blog: "true",
  enable_marketing_popups: "true",
  enable_social_proof: "true",
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
  standard_shipping_enabled: "true",
  standard_delivery_estimate: "3-7 business days",
  free_shipping_threshold: "2500",
  express_shipping: "false",
  express_shipping_fee: "199",
  express_delivery_estimate: "1-3 business days",
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
  loyalty_earn_rate: "1",
  loyalty_redeem_rate: "1",
  loyalty_min_redemption: "100",
  loyalty_max_redemption_percent: "20",
  loyalty_points_expiry_days: "365",
  referral_reward_amount: "100",
  referral_expiry_days: "90",
  recent_purchase_window_hours: "72",
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
export const BUSINESS_SETTINGS_QUERY_KEY = ["business-settings"] as const;

type BusinessSettingsContextValue = {
  settings: BusinessSettings;
  data: BusinessSettings;
  loading: boolean;
  isLoading: boolean;
  error: Error | null;
  refreshSettings: () => Promise<void>;
};

const BusinessSettingsContext = createContext<BusinessSettingsContextValue | null>(null);

export function supabaseProjectRefFromUrl(url = publicSupabase.supabaseUrl) {
  try {
    return new URL(url).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

function publicEnvDiagnostics() {
  return {
    supabaseUrl: publicSupabase.supabaseUrl,
    supabaseProjectRef: publicSupabaseProjectRef(),
    vercelCommitSha: import.meta.env.VERCEL_GIT_COMMIT_SHA || "",
    vercelUrl: import.meta.env.VERCEL_URL || "",
  };
}

export async function fetchBusinessSettings(): Promise<BusinessSettings> {
  try {
    const { data, error } = await publicSupabase
      .from("business_settings")
      .select("key,value");
    if (error) {
      console.warn("[business-settings] Falling back to bundled public defaults", error.message);
      return { ...DEFAULT_BUSINESS_SETTINGS } as BusinessSettings;
    }

    return (data ?? []).reduce(
      (settings, row) =>
        row.key in settings && !SECRET_SETTING_PATTERN.test(row.key)
          ? { ...settings, [row.key]: row.value }
          : settings,
      { ...DEFAULT_BUSINESS_SETTINGS } as BusinessSettings,
    );
  } catch (error) {
    console.warn("[business-settings] Falling back to bundled public defaults", error);
    return { ...DEFAULT_BUSINESS_SETTINGS } as BusinessSettings;
  }
}

export function BusinessSettingsProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const query = useQuery({
    queryKey: BUSINESS_SETTINGS_QUERY_KEY,
    queryFn: fetchBusinessSettings,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const settings = query.data ?? ({ ...DEFAULT_BUSINESS_SETTINGS } as BusinessSettings);
  const error = query.error instanceof Error ? query.error : null;
  const authState = authLoading ? "loading" : isAdmin ? "admin" : user ? "user" : "anon";

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const diagnostics = publicEnvDiagnostics();
    console.info("[business-settings]", {
      ...diagnostics,
      authState,
      contact_email: settings.contact_email,
      facebook_url: settings.facebook_url,
      logo_url: settings.logo_url,
    });
  }, [
    authState,
    settings.contact_email,
    settings.facebook_url,
    settings.logo_url,
  ]);

  useEffect(() => {
    const { vercelCommitSha, vercelUrl } = publicEnvDiagnostics();
    if (!vercelCommitSha && !vercelUrl) return;
    console.info("[build-version]", {
      vercelCommitSha,
      vercelUrl,
    });
  }, []);

  const refreshSettings = async () => {
    await query.refetch();
  };

  return (
    <BusinessSettingsContext.Provider
      value={{
        settings,
        data: settings,
        loading: query.isLoading,
        isLoading: query.isLoading,
        error,
        refreshSettings,
      }}
    >
      {children}
    </BusinessSettingsContext.Provider>
  );
}

export function useBusinessSettings() {
  const ctx = useContext(BusinessSettingsContext);
  if (!ctx) {
    throw new Error("useBusinessSettings must be used within BusinessSettingsProvider");
  }
  return ctx;
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
