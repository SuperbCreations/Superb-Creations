import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { publicSupabase } from "@/integrations/supabase/public-client";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/lib/products";

const publicDb = publicSupabase as any;
const db = supabase as any;
const HIDDEN_PRODUCT_STATUSES = ["archived", "deleted", "draft", "hidden", "inactive"];

const visibleProducts = (query: any) =>
  query
    .eq("active", true)
    .not("product_status", "in", `(${HIDDEN_PRODUCT_STATUSES.join(",")})`);

export type BlogCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  active: boolean;
};

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  banner_image_url: string;
  category_id: string | null;
  blog_categories?: BlogCategory | null;
  tags: string[];
  status: "draft" | "published" | "archived";
  featured: boolean;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  canonical_url: string;
  og_image_url: string;
  robots: string;
  reading_minutes: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketingPopup = {
  id: string;
  name: string;
  popup_type: string;
  title: string;
  body: string;
  cta_label: string;
  cta_url: string;
  coupon_code: string;
  image_url: string;
  active: boolean;
  target_pages: string[];
  frequency: string;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
};

export type PageSeo = {
  page_key: string;
  title: string;
  description: string;
  keywords: string;
  canonical_url: string;
  og_title: string;
  og_description: string;
  og_image_url: string;
  twitter_image_url: string;
  robots: string;
  structured_data: Record<string, unknown>;
};

export type RecommendationRule = {
  id: string;
  name: string;
  rule_type: string;
  active: boolean;
  product_id: string | null;
  related_product_ids: string[];
  sort_order: number;
  metadata: Record<string, unknown>;
};

export function readingMinutes(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

export function useBlogPosts(options: { includeDrafts?: boolean; search?: string; category?: string } = {}) {
  return useQuery({
    queryKey: ["blog-posts", options],
    queryFn: async (): Promise<BlogPost[]> => {
      let query = (options.includeDrafts ? db : publicDb)
        .from("blog_posts")
        .select("*, blog_categories(*)")
        .order("featured", { ascending: false })
        .order("published_at", { ascending: false });
      if (!options.includeDrafts) query = query.eq("status", "published");
      if (options.search) {
        const q = `%${options.search.trim()}%`;
        query = query.or(`title.ilike.${q},excerpt.ilike.${q},content.ilike.${q}`);
      }
      if (options.category) {
        query = query.eq("blog_categories.slug", options.category);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBlogPost(slug: string | undefined, includeDrafts = false) {
  return useQuery({
    queryKey: ["blog-post", slug, includeDrafts],
    enabled: !!slug,
    queryFn: async (): Promise<BlogPost | null> => {
      let query = (includeDrafts ? db : publicDb)
        .from("blog_posts")
        .select("*, blog_categories(*)")
        .eq("slug", slug);
      if (!includeDrafts) query = query.eq("status", "published");
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useBlogCategories(includeInactive = false) {
  return useQuery({
    queryKey: ["blog-categories", includeInactive],
    queryFn: async (): Promise<BlogCategory[]> => {
      let query = (includeInactive ? db : publicDb)
        .from("blog_categories")
        .select("*")
        .order("sort_order")
        .order("name");
      if (!includeInactive) query = query.eq("active", true);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePageSeo(pageKey: string) {
  return useQuery({
    queryKey: ["page-seo", pageKey],
    queryFn: async (): Promise<PageSeo | null> => {
      const { data, error } = await publicDb
        .from("page_seo_settings")
        .select("*")
        .eq("page_key", pageKey)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminSeoSettings() {
  return useQuery({
    queryKey: ["admin-seo-settings"],
    queryFn: async (): Promise<PageSeo[]> => {
      const { data, error } = await db
        .from("page_seo_settings")
        .select("*")
        .order("page_key");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSavePageSeo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (seo: Partial<PageSeo>) => {
      if (!seo.page_key) throw new Error("Page key is required.");
      const { error } = await db.from("page_seo_settings").upsert(
        {
          ...seo,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "page_key" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-seo-settings"] });
      qc.invalidateQueries({ queryKey: ["page-seo"] });
    },
  });
}

export function useRecommendationRules(includeInactive = false) {
  return useQuery({
    queryKey: ["recommendation-rules", includeInactive],
    queryFn: async (): Promise<RecommendationRule[]> => {
      let query = (includeInactive ? db : publicDb)
        .from("recommendation_rules")
        .select("*")
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (!includeInactive) query = query.eq("active", true);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveRecommendationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Partial<RecommendationRule>) => {
      const payload = { ...rule, updated_at: new Date().toISOString() };
      const query = rule.id
        ? db.from("recommendation_rules").update(payload).eq("id", rule.id)
        : db.from("recommendation_rules").insert(payload);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recommendation-rules"] });
      qc.invalidateQueries({ queryKey: ["growth-analytics"] });
    },
  });
}

export function useMarketingPopups(pathname: string) {
  return useQuery({
    queryKey: ["marketing-popups", pathname],
    queryFn: async (): Promise<MarketingPopup[]> => {
      const { data, error } = await publicDb
        .from("marketing_popups")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []).filter((popup: MarketingPopup) => {
        if (!popup.target_pages?.length) return true;
        return popup.target_pages.includes(pathname) || popup.target_pages.includes("*");
      });
    },
  });
}

export function useAdminMarketingPopups() {
  return useQuery({
    queryKey: ["admin-marketing-popups"],
    queryFn: async (): Promise<MarketingPopup[]> => {
      const { data, error } = await db
        .from("marketing_popups")
        .select("*")
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRecordPopupEvent() {
  return useMutation({
    mutationFn: async (event: {
      popupId: string;
      eventType: "impression" | "click" | "dismiss";
      userId?: string;
      sessionId?: string;
      path?: string;
    }) => {
      const { error } = await db.from("marketing_popup_events").insert({
        popup_id: event.popupId,
        event_type: event.eventType,
        user_id: event.userId || null,
        session_id: event.sessionId || null,
        path: event.path || "",
      });
      if (error) throw error;
    },
  });
}

export function useTrendingProducts(limit = 4) {
  return useQuery({
    queryKey: ["trending-products", limit],
    queryFn: async (): Promise<Product[]> => {
      const query = publicDb
        .from("products")
        .select("*")
        .order("lifetime_sales", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      const { data, error } = await visibleProducts(query);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSimilarProducts(product: Product | null | undefined, limit = 4) {
  return useQuery({
    queryKey: ["similar-products", product?.id, limit],
    enabled: !!product,
    queryFn: async (): Promise<Product[]> => {
      const query = publicDb
        .from("products")
        .select("*")
        .eq("category", product!.category)
        .neq("id", product!.id)
        .order("lifetime_sales", { ascending: false })
        .limit(limit);
      const { data, error } = await visibleProducts(query);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useReferralCode(userId: string | undefined) {
  return useQuery({
    queryKey: ["referral-code", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db.rpc("generate_referral_code", { p_user_id: userId });
      if (error) throw error;
      return String(data || "");
    },
  });
}

export function useGrowthAnalytics() {
  return useQuery({
    queryKey: ["growth-analytics"],
    queryFn: async () => {
      const { data, error } = await db.rpc("get_growth_analytics");
      if (error) throw error;
      return data ?? {};
    },
  });
}

export function useSaveBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (post: Partial<BlogPost>) => {
      const payload = {
        ...post,
        reading_minutes: readingMinutes(post.content || ""),
        updated_at: new Date().toISOString(),
      };
      const query = post.id
        ? db.from("blog_posts").update(payload).eq("id", post.id)
        : db.from("blog_posts").insert(payload);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blog-posts"] });
      qc.invalidateQueries({ queryKey: ["growth-analytics"] });
    },
  });
}

export function useSaveMarketingPopup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (popup: Partial<MarketingPopup>) => {
      const payload = { ...popup, updated_at: new Date().toISOString() };
      const query = popup.id
        ? db.from("marketing_popups").update(payload).eq("id", popup.id)
        : db.from("marketing_popups").insert(payload);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-popups"] });
      qc.invalidateQueries({ queryKey: ["admin-marketing-popups"] });
      qc.invalidateQueries({ queryKey: ["growth-analytics"] });
    },
  });
}
