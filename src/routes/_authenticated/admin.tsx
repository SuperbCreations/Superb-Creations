import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Archive,
  RotateCcw,
  Loader2,
  LogOut,
  Upload,
  X,
  Layers,
  Eye,
  EyeOff,
  Star,
  Download,
  FileText,
  PackageCheck,
  Truck,
  Search,
  Users,
  Ticket,
  Gift,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CATEGORIES, inr, type Product, type Variant } from "@/lib/products";
import type { LookbookItem } from "@/lib/lookbook";
import {
  DEFAULT_BUSINESS_SETTINGS,
  businessSettingRows,
  supabaseProjectRefFromUrl,
  useBusinessSettings,
  type BusinessSettings,
} from "@/lib/business-settings";
import {
  adjustInventoryStock,
  bulkUpdateOrders,
  cancelShipment,
  confirmManualOrder,
  createShipment,
  fetchTracking,
  rejectManualPayment,
  resolveRefund,
  syncShipmentStatus,
  updateOrderOperations,
} from "@/lib/orders.functions";
import { checkBrevoConnection, sendBrevoTestEmail, sendNewsletterCampaign } from "@/lib/notifications.functions";
import {
  useBlogCategories,
  useBlogPosts,
  useGrowthAnalytics,
  useAdminSeoSettings,
  useSaveBlogPost,
  useSaveMarketingPopup,
  useSavePageSeo,
  useRecommendationRules,
  useSaveRecommendationRule,
  useAdminMarketingPopups,
  type BlogPost,
  type MarketingPopup,
  type PageSeo,
  type RecommendationRule,
} from "@/lib/growth";
import {
  useAdminPaymentMethods,
  usePaymentAnalytics,
  useRefundRequests,
  useSavePaymentMethod,
  type PaymentMethod,
} from "@/lib/payments";
import { markSystemErrorResolved, metadataPreview } from "@/lib/observability";
import { runProductionTaskAsAdmin } from "@/lib/production-ops.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Superb Creations" }] }),
  component: AdminPage,
});

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

type Draft = {
  id?: string;
  name: string;
  slug: string;
  category: string;
  price: number;
  description: string;
  image_url: string;
  tag: string;
  active: boolean;
  in_stock: boolean;
  stock: number;
  low_stock_threshold: number;
  product_status: string;
  sort_order: number;
  weight_grams: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  fragile: boolean;
  special_packaging: boolean;
  shipping_class: string;
  free_shipping_eligible: boolean;
};

const emptyDraft = (): Draft => ({
  name: "",
  slug: "",
  category: CATEGORIES[0],
  price: 0,
  description: "",
  image_url: "",
  tag: "",
  active: true,
  in_stock: true,
  stock: 0,
  low_stock_threshold: 5,
  product_status: "active",
  sort_order: 0,
  weight_grams: 500,
  length_cm: 0,
  width_cm: 0,
  height_cm: 0,
  fragile: false,
  special_packaging: false,
  shipping_class: "standard",
  free_shipping_eligible: true,
});

function AdminPage() {
  const { isAdmin, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] =
    useState<"products" | "lookbook" | "orders" | "analytics" | "reviews" | "customers" | "coupons" | "growth" | "settings" | "system">("products");

  useEffect(() => {
    if (!loading && user && !isAdmin) {
      toast.error("Admin access is restricted to the store owner.");
      navigate({ to: "/account", replace: true });
    }
  }, [isAdmin, loading, navigate, user]);

  if (loading) {
    return (
      <div className="container-boutique flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container-boutique flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="font-display text-3xl">Restricted area</h1>
        <p className="max-w-md text-muted-foreground">
          This area is for the store owner only. You're signed in as{" "}
          <span className="font-medium">{user?.email}</span>, which doesn't have admin access.
        </p>
        <button
          onClick={signOut}
          className="rounded-full border border-border px-6 py-2.5 text-xs uppercase tracking-[0.2em]"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <section className="container-boutique py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Owner dashboard</p>
          <h1 className="mt-2 font-display text-4xl">Manage store</h1>
        </div>
        <button
          onClick={signOut}
          className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-xs uppercase tracking-[0.2em]"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>

      <div className="mt-8 flex gap-2 border-b border-border">
        {(["products", "lookbook", "orders", "analytics", "reviews", "customers", "coupons", "growth", "settings", "system"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "px-4 py-2.5 text-sm capitalize transition-colors " +
              (tab === t
                ? "border-b-2 border-primary font-medium"
                : "text-muted-foreground")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "products" && <ProductsAdmin />}
      {tab === "lookbook" && <LookbookAdmin />}
      {tab === "orders" && <OrdersAdmin />}
      {tab === "analytics" && <AnalyticsAdmin />}
      {tab === "reviews" && <ReviewsAdmin />}
      {tab === "customers" && <CustomersAdmin />}
      {tab === "coupons" && <CouponsAdmin />}
      {tab === "growth" && <GrowthAdmin />}
      {tab === "settings" && <SettingsAdmin />}
      {tab === "system" && <SystemAdmin />}
    </section>
  );
}

function GrowthAdmin() {
  const qc = useQueryClient();
  const { data: analytics = {}, isLoading: analyticsLoading } = useGrowthAnalytics();
  const { data: categories = [] } = useBlogCategories(true);
  const { data: posts = [] } = useBlogPosts({ includeDrafts: true });
  const { data: popups = [] } = useAdminMarketingPopups();
  const { data: seoSettings = [] } = useAdminSeoSettings();
  const { data: recommendationRules = [] } = useRecommendationRules(true);
  const savePost = useSaveBlogPost();
  const savePopup = useSaveMarketingPopup();
  const saveSeo = useSavePageSeo();
  const saveRecommendationRule = useSaveRecommendationRule();
  const { settings } = useBusinessSettings();
  const [postDraft, setPostDraft] = useState<Partial<BlogPost> | null>(null);
  const [popupDraft, setPopupDraft] = useState<Partial<MarketingPopup> | null>(null);
  const [seoDraft, setSeoDraft] = useState<Partial<PageSeo> | null>(null);
  const [ruleDraft, setRuleDraft] = useState<Partial<RecommendationRule> | null>(null);
  const [growthSettings, setGrowthSettings] = useState({
    enable_loyalty: settings.enable_loyalty ?? "true",
    loyalty_earn_rate: settings.loyalty_earn_rate ?? "1",
    loyalty_redeem_rate: settings.loyalty_redeem_rate ?? "1",
    loyalty_min_redemption: settings.loyalty_min_redemption ?? "100",
    loyalty_max_redemption_percent: settings.loyalty_max_redemption_percent ?? "20",
    loyalty_points_expiry_days: settings.loyalty_points_expiry_days ?? "365",
    enable_referrals: settings.enable_referrals ?? "true",
    referral_reward_amount: settings.referral_reward_amount ?? "100",
    referral_expiry_days: settings.referral_expiry_days ?? "90",
    enable_blog: settings.enable_blog ?? "true",
    enable_marketing_popups: settings.enable_marketing_popups ?? "true",
    enable_social_proof: settings.enable_social_proof ?? "true",
  });

  const saveGrowthSettings = useMutation({
    mutationFn: async () => {
      const rows = Object.entries(growthSettings).map(([key, value]) => ({ key, value }));
      const { error } = await supabase.from("business_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-settings"] });
      toast.success("Growth settings saved.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save growth settings."),
  });

  const metric = (group: string, key: string) => Number((analytics as any)?.[group]?.[key] ?? 0);

  const newPost = () =>
    setPostDraft({
      title: "",
      slug: "",
      excerpt: "",
      content: "",
      banner_image_url: "",
      category_id: categories[0]?.id ?? null,
      tags: [],
      status: "draft",
      featured: false,
      seo_title: "",
      seo_description: "",
      seo_keywords: "",
      canonical_url: "",
      og_image_url: "",
      robots: "index,follow",
    });

  const newPopup = () =>
    setPopupDraft({
      name: "",
      popup_type: "newsletter",
      title: "",
      body: "",
      cta_label: "Shop now",
      cta_url: "/shop",
      coupon_code: "",
      image_url: "",
      active: false,
      target_pages: ["*"],
      frequency: "once_per_session",
      sort_order: 0,
    });

  const newSeo = () =>
    setSeoDraft({
      page_key: "",
      title: "",
      description: "",
      keywords: "",
      canonical_url: "",
      og_title: "",
      og_description: "",
      og_image_url: "",
      twitter_image_url: "",
      robots: "index,follow",
      structured_data: {},
    });

  const newRule = () =>
    setRuleDraft({
      name: "",
      rule_type: "trending",
      active: true,
      product_id: null,
      related_product_ids: [],
      sort_order: 0,
      metadata: {},
    });

  return (
    <section className="mt-8 space-y-8">
      <div>
        <p className="eyebrow">Growth</p>
        <h2 className="mt-2 font-display text-3xl">Loyalty, referrals, blog and marketing</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Available Points", metric("loyalty", "availablePoints")],
          ["Successful Referrals", metric("referrals", "successful")],
          ["Published Posts", metric("blog", "published")],
          ["Popup Clicks", metric("marketing", "clicks")],
        ].map(([label, value]) => (
          <div key={label} className="rounded-sm border border-border p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
            <p className="mt-2 font-display text-3xl">{analyticsLoading ? "..." : value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-sm border border-border p-5">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-display text-2xl">Growth settings</h3>
          <button
            type="button"
            onClick={() => saveGrowthSettings.mutate()}
            disabled={saveGrowthSettings.isPending}
            className="rounded-full bg-primary px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-60"
          >
            Save settings
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {Object.entries(growthSettings).map(([key, value]) => (
            <Field key={key} label={key.replaceAll("_", " ")}>
              {value === "true" || value === "false" ? (
                <select
                  className={inputCls}
                  value={value}
                  onChange={(e) => setGrowthSettings((current) => ({ ...current, [key]: e.target.value }))}
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              ) : (
                <input
                  className={inputCls}
                  value={value}
                  onChange={(e) => setGrowthSettings((current) => ({ ...current, [key]: e.target.value }))}
                />
              )}
            </Field>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-sm border border-border p-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-display text-2xl">Blog CMS</h3>
            <button onClick={newPost} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.18em]">
              <Plus size={14} /> Article
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {posts.map((post) => (
              <div key={post.id} className="rounded-sm border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{post.title}</p>
                    <p className="text-xs text-muted-foreground">{post.status} · {post.slug}</p>
                  </div>
                  <button onClick={() => setPostDraft(post)} className="rounded-full border border-border px-3 py-1 text-xs">Edit</button>
                </div>
              </div>
            ))}
            {posts.length === 0 && <p className="text-sm text-muted-foreground">No articles yet.</p>}
          </div>
        </div>

        <div className="rounded-sm border border-border p-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-display text-2xl">Marketing popups</h3>
            <button onClick={newPopup} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.18em]">
              <Plus size={14} /> Popup
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {popups.map((popup) => (
              <div key={popup.id} className="rounded-sm border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{popup.title}</p>
                    <p className="text-xs text-muted-foreground">{popup.popup_type} · {popup.active ? "active" : "inactive"}</p>
                  </div>
                  <button onClick={() => setPopupDraft(popup)} className="rounded-full border border-border px-3 py-1 text-xs">Edit</button>
                </div>
              </div>
            ))}
            {popups.length === 0 && <p className="text-sm text-muted-foreground">No popups yet.</p>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-sm border border-border p-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-display text-2xl">SEO management</h3>
            <button onClick={newSeo} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.18em]">
              <Plus size={14} /> SEO
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {seoSettings.map((seo) => (
              <div key={seo.page_key} className="rounded-sm border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{seo.page_key}</p>
                    <p className="text-xs text-muted-foreground">{seo.title || "No title"}</p>
                  </div>
                  <button onClick={() => setSeoDraft(seo)} className="rounded-full border border-border px-3 py-1 text-xs">Edit</button>
                </div>
              </div>
            ))}
            {seoSettings.length === 0 && <p className="text-sm text-muted-foreground">No page SEO overrides yet.</p>}
          </div>
        </div>

        <div className="rounded-sm border border-border p-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-display text-2xl">Recommendation rules</h3>
            <button onClick={newRule} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.18em]">
              <Plus size={14} /> Rule
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {recommendationRules.map((rule) => (
              <div key={rule.id} className="rounded-sm border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{rule.name}</p>
                    <p className="text-xs text-muted-foreground">{rule.rule_type} · {rule.active ? "active" : "inactive"}</p>
                  </div>
                  <button onClick={() => setRuleDraft(rule)} className="rounded-full border border-border px-3 py-1 text-xs">Edit</button>
                </div>
              </div>
            ))}
            {recommendationRules.length === 0 && <p className="text-sm text-muted-foreground">No custom recommendation rules yet.</p>}
          </div>
        </div>
      </div>

      {postDraft && (
        <div className="rounded-sm border border-border p-5">
          <h3 className="font-display text-2xl">{postDraft.id ? "Edit article" : "New article"}</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Title"><input className={inputCls} value={postDraft.title ?? ""} onChange={(e) => setPostDraft({ ...postDraft, title: e.target.value, slug: postDraft.slug || slugify(e.target.value) })} /></Field>
            <Field label="Slug"><input className={inputCls} value={postDraft.slug ?? ""} onChange={(e) => setPostDraft({ ...postDraft, slug: slugify(e.target.value) })} /></Field>
            <Field label="Category">
              <select className={inputCls} value={postDraft.category_id ?? ""} onChange={(e) => setPostDraft({ ...postDraft, category_id: e.target.value || null })}>
                <option value="">None</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputCls} value={postDraft.status ?? "draft"} onChange={(e) => setPostDraft({ ...postDraft, status: e.target.value as BlogPost["status"], published_at: e.target.value === "published" ? new Date().toISOString() : postDraft.published_at })}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <Field label="Banner image URL"><input className={inputCls} value={postDraft.banner_image_url ?? ""} onChange={(e) => setPostDraft({ ...postDraft, banner_image_url: e.target.value })} /></Field>
            <Field label="Tags"><input className={inputCls} value={(postDraft.tags ?? []).join(", ")} onChange={(e) => setPostDraft({ ...postDraft, tags: e.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} /></Field>
            <Field label="Excerpt"><textarea rows={3} className={inputCls} value={postDraft.excerpt ?? ""} onChange={(e) => setPostDraft({ ...postDraft, excerpt: e.target.value })} /></Field>
            <Field label="SEO description"><textarea rows={3} className={inputCls} value={postDraft.seo_description ?? ""} onChange={(e) => setPostDraft({ ...postDraft, seo_description: e.target.value })} /></Field>
            <div className="sm:col-span-2">
              <Field label="Content"><textarea rows={8} className={inputCls} value={postDraft.content ?? ""} onChange={(e) => setPostDraft({ ...postDraft, content: e.target.value })} /></Field>
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <button onClick={() => savePost.mutate(postDraft, { onSuccess: () => { setPostDraft(null); toast.success("Article saved."); } })} className="rounded-full bg-primary px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground">Save article</button>
            <button onClick={() => setPostDraft(null)} className="rounded-full border border-border px-6 py-2.5 text-xs uppercase tracking-[0.2em]">Cancel</button>
          </div>
        </div>
      )}

      {popupDraft && (
        <div className="rounded-sm border border-border p-5">
          <h3 className="font-display text-2xl">{popupDraft.id ? "Edit popup" : "New popup"}</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Name"><input className={inputCls} value={popupDraft.name ?? ""} onChange={(e) => setPopupDraft({ ...popupDraft, name: e.target.value })} /></Field>
            <Field label="Type">
              <select className={inputCls} value={popupDraft.popup_type ?? "newsletter"} onChange={(e) => setPopupDraft({ ...popupDraft, popup_type: e.target.value })}>
                {["newsletter", "discount", "exit_intent", "welcome", "festival", "manual"].map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="Title"><input className={inputCls} value={popupDraft.title ?? ""} onChange={(e) => setPopupDraft({ ...popupDraft, title: e.target.value })} /></Field>
            <Field label="CTA URL"><input className={inputCls} value={popupDraft.cta_url ?? ""} onChange={(e) => setPopupDraft({ ...popupDraft, cta_url: e.target.value })} /></Field>
            <Field label="CTA label"><input className={inputCls} value={popupDraft.cta_label ?? ""} onChange={(e) => setPopupDraft({ ...popupDraft, cta_label: e.target.value })} /></Field>
            <Field label="Coupon code"><input className={inputCls} value={popupDraft.coupon_code ?? ""} onChange={(e) => setPopupDraft({ ...popupDraft, coupon_code: e.target.value.toUpperCase() })} /></Field>
            <Field label="Image URL"><input className={inputCls} value={popupDraft.image_url ?? ""} onChange={(e) => setPopupDraft({ ...popupDraft, image_url: e.target.value })} /></Field>
            <Field label="Active">
              <select className={inputCls} value={popupDraft.active ? "true" : "false"} onChange={(e) => setPopupDraft({ ...popupDraft, active: e.target.value === "true" })}>
                <option value="false">Inactive</option>
                <option value="true">Active</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Body"><textarea rows={4} className={inputCls} value={popupDraft.body ?? ""} onChange={(e) => setPopupDraft({ ...popupDraft, body: e.target.value })} /></Field>
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <button onClick={() => savePopup.mutate(popupDraft, { onSuccess: () => { setPopupDraft(null); toast.success("Popup saved."); } })} className="rounded-full bg-primary px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground">Save popup</button>
            <button onClick={() => setPopupDraft(null)} className="rounded-full border border-border px-6 py-2.5 text-xs uppercase tracking-[0.2em]">Cancel</button>
          </div>
        </div>
      )}

      {seoDraft && (
        <div className="rounded-sm border border-border p-5">
          <h3 className="font-display text-2xl">{seoDraft.page_key ? "Edit SEO" : "New SEO override"}</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Page key"><input className={inputCls} value={seoDraft.page_key ?? ""} onChange={(e) => setSeoDraft({ ...seoDraft, page_key: e.target.value })} /></Field>
            <Field label="Robots"><input className={inputCls} value={seoDraft.robots ?? "index,follow"} onChange={(e) => setSeoDraft({ ...seoDraft, robots: e.target.value })} /></Field>
            <Field label="Title"><input className={inputCls} value={seoDraft.title ?? ""} onChange={(e) => setSeoDraft({ ...seoDraft, title: e.target.value })} /></Field>
            <Field label="Canonical URL"><input className={inputCls} value={seoDraft.canonical_url ?? ""} onChange={(e) => setSeoDraft({ ...seoDraft, canonical_url: e.target.value })} /></Field>
            <Field label="Description"><textarea rows={3} className={inputCls} value={seoDraft.description ?? ""} onChange={(e) => setSeoDraft({ ...seoDraft, description: e.target.value })} /></Field>
            <Field label="Open Graph description"><textarea rows={3} className={inputCls} value={seoDraft.og_description ?? ""} onChange={(e) => setSeoDraft({ ...seoDraft, og_description: e.target.value })} /></Field>
            <Field label="Keywords"><input className={inputCls} value={seoDraft.keywords ?? ""} onChange={(e) => setSeoDraft({ ...seoDraft, keywords: e.target.value })} /></Field>
            <Field label="OG image URL"><input className={inputCls} value={seoDraft.og_image_url ?? ""} onChange={(e) => setSeoDraft({ ...seoDraft, og_image_url: e.target.value })} /></Field>
          </div>
          <div className="mt-5 flex gap-2">
            <button onClick={() => saveSeo.mutate(seoDraft, { onSuccess: () => { setSeoDraft(null); toast.success("SEO saved."); } })} className="rounded-full bg-primary px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground">Save SEO</button>
            <button onClick={() => setSeoDraft(null)} className="rounded-full border border-border px-6 py-2.5 text-xs uppercase tracking-[0.2em]">Cancel</button>
          </div>
        </div>
      )}

      {ruleDraft && (
        <div className="rounded-sm border border-border p-5">
          <h3 className="font-display text-2xl">{ruleDraft.id ? "Edit recommendation rule" : "New recommendation rule"}</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Name"><input className={inputCls} value={ruleDraft.name ?? ""} onChange={(e) => setRuleDraft({ ...ruleDraft, name: e.target.value })} /></Field>
            <Field label="Type">
              <select className={inputCls} value={ruleDraft.rule_type ?? "trending"} onChange={(e) => setRuleDraft({ ...ruleDraft, rule_type: e.target.value })}>
                {["trending", "popular", "best_sellers", "similar", "frequently_bought_together", "recommended_for_you"].map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="Product ID"><input className={inputCls} value={ruleDraft.product_id ?? ""} onChange={(e) => setRuleDraft({ ...ruleDraft, product_id: e.target.value || null })} /></Field>
            <Field label="Related product IDs"><input className={inputCls} value={(ruleDraft.related_product_ids ?? []).join(",")} onChange={(e) => setRuleDraft({ ...ruleDraft, related_product_ids: e.target.value.split(",").map((id) => id.trim()).filter(Boolean) })} /></Field>
            <Field label="Sort order"><input type="number" className={inputCls} value={ruleDraft.sort_order ?? 0} onChange={(e) => setRuleDraft({ ...ruleDraft, sort_order: Number(e.target.value) })} /></Field>
            <Field label="Active">
              <select className={inputCls} value={ruleDraft.active ? "true" : "false"} onChange={(e) => setRuleDraft({ ...ruleDraft, active: e.target.value === "true" })}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </Field>
          </div>
          <div className="mt-5 flex gap-2">
            <button onClick={() => saveRecommendationRule.mutate(ruleDraft, { onSuccess: () => { setRuleDraft(null); toast.success("Rule saved."); } })} className="rounded-full bg-primary px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground">Save rule</button>
            <button onClick={() => setRuleDraft(null)} className="rounded-full border border-border px-6 py-2.5 text-xs uppercase tracking-[0.2em]">Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}

function SystemAdmin() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const runTaskFn = useServerFn(runProductionTaskAsAdmin);
  const [severity, setSeverity] = useState("all");
  const [source, setSource] = useState("all");

  const { data: errors = [] } = useQuery({
    queryKey: ["system-error-logs", severity, source],
    queryFn: async () => {
      let query = (supabase as any)
        .from("system_error_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80);
      if (severity !== "all") query = query.eq("severity", severity);
      if (source !== "all") query = query.eq("source", source);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("admin_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cronLogs = [] } = useQuery({
    queryKey: ["cron-run-logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cron_run_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: queueStats = {} } = useQuery({
    queryKey: ["email-queue-stats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("email_queue").select("status");
      if (error) throw error;
      return (data ?? []).reduce((acc: Record<string, number>, row: any) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
      }, {});
    },
  });

  const runTask = useMutation({
    mutationFn: async (task: "expire_due_manual_payment_orders" | "process_email_queue" | "generate_daily_analytics_snapshot" | "sync_shipment_statuses" | "cleanup_old_events" | "check_system_health") => {
      if (!session?.access_token) throw new Error("Please sign in again.");
      return runTaskFn({ data: { accessToken: session.access_token, task } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cron-run-logs"] });
      qc.invalidateQueries({ queryKey: ["system-error-logs"] });
      qc.invalidateQueries({ queryKey: ["email-queue-stats"] });
      toast.success("Task completed.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Task failed."),
  });

  const resolveError = useMutation({
    mutationFn: markSystemErrorResolved,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system-error-logs"] });
      toast.success("Error marked resolved.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update error."),
  });

  const exportAudit = () =>
    downloadCsv("admin-audit-logs.csv", [
      ["created_at", "actor_email", "action", "entity_type", "entity_id", "summary"],
      ...auditLogs.map((row: any) => [row.created_at, row.actor_email, row.action, row.entity_type, row.entity_id, row.summary]),
    ]);

  return (
    <section className="mt-8 space-y-6">
      <div>
        <p className="eyebrow">Production</p>
        <h2 className="mt-2 font-display text-3xl">System health and security</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Unresolved Errors", errors.filter((e: any) => !e.resolved).length],
          ["Queued Emails", (queueStats as any).queued || 0],
          ["Failed Emails", ((queueStats as any).failed || 0) + ((queueStats as any).permanently_failed || 0)],
          ["Audit Events", auditLogs.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-sm border border-border p-4">
            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-2xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-sm border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Workers</p>
            <h3 className="mt-1 font-display text-2xl">Run maintenance tasks</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              "expire_due_manual_payment_orders",
              "process_email_queue",
              "generate_daily_analytics_snapshot",
              "sync_shipment_statuses",
              "cleanup_old_events",
              "check_system_health",
            ].map((task) => (
              <button
                key={task}
                type="button"
                disabled={runTask.isPending}
                onClick={() => runTask.mutate(task as any)}
                className="rounded-full border border-border px-3 py-1.5 text-xs"
              >
                {task.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 space-y-2 text-xs">
          {cronLogs.map((row: any) => (
            <div key={row.id} className="rounded-sm bg-secondary/40 p-3">
              <p className="font-medium">{row.task} · {statusLabel(row.status)}</p>
              <p className="text-muted-foreground">{new Date(row.started_at).toLocaleString("en-IN")}</p>
              {row.error && <p className="text-destructive">{row.error}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-sm border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Errors</p>
              <h3 className="mt-1 font-display text-2xl">Recent system errors</h3>
            </div>
            <div className="flex gap-2">
              <select className={inputCls} value={severity} onChange={(e) => setSeverity(e.target.value)}>
                {["all", "critical", "error", "warning", "info"].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value)}>
                {["all", "client", "server", "checkout", "webhook", "cron", "analytics", "newsletter"].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {errors.map((row: any) => (
              <div key={row.id} className="rounded-sm border border-border p-3 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{statusLabel(row.severity)} · {row.source}</p>
                    <p className="mt-1 text-muted-foreground">{row.message}</p>
                    <p className="mt-1 text-muted-foreground">{new Date(row.created_at).toLocaleString("en-IN")} · {row.request_path || "no path"}</p>
                  </div>
                  {!row.resolved && (
                    <button onClick={() => resolveError.mutate(row.id)} className="rounded-full border border-border px-2 py-1">
                      Resolve
                    </button>
                  )}
                </div>
                {row.metadata && <pre className="mt-2 max-h-28 overflow-auto rounded-sm bg-secondary/40 p-2">{metadataPreview(row.metadata)}</pre>}
              </div>
            ))}
            {errors.length === 0 && <p className="text-sm text-muted-foreground">No system errors for this filter.</p>}
          </div>
        </div>

        <div className="rounded-sm border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Audit</p>
              <h3 className="mt-1 font-display text-2xl">Admin audit log</h3>
            </div>
            <button onClick={exportAudit} className="rounded-full border border-border px-3 py-1.5 text-xs">
              Export CSV
            </button>
          </div>
          <div className="mt-4 space-y-2 text-xs">
            {auditLogs.slice(0, 30).map((row: any) => (
              <div key={row.id} className="rounded-sm border border-border p-3">
                <p className="font-medium">{row.entity_type} · {row.action}</p>
                <p className="text-muted-foreground">{row.summary || row.entity_id || "No summary"}</p>
                <p className="text-muted-foreground">{new Date(row.created_at).toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-sm border border-border p-4">
        <p className="eyebrow">Readiness</p>
        <h3 className="mt-1 font-display text-2xl">Backup and recovery checklist</h3>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {[
            "Supabase PITR/backups enabled for production project",
            "Monthly database export tested",
            "Storage buckets backed up: product-images, lookbook-images, business-media, payment-screenshots",
            "Vercel env vars match .env.example and production checklist",
            "Razorpay webhook secret configured and tested",
            "Brevo sender/domain verified and webhook token configured",
            "CRON_SECRET configured for /api/admin/cron/run",
            "Restore procedure documented in docs/production-readiness.md",
          ].map((item) => (
            <label key={item} className="flex items-center gap-2">
              <input type="checkbox" readOnly /> {item}
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductsAdmin() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const adjustInventoryStockFn = useServerFn(adjustInventoryStock);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [variantsFor, setVariantsFor] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const payload = {
        name: d.name,
        slug: d.slug || slugify(d.name),
        category: d.category,
        price: Math.round(d.price),
        description: d.description,
        image_url: d.image_url,
        tag: d.tag || null,
        active: d.active,
        in_stock: d.in_stock,
        stock: Math.max(0, Math.round(d.stock || 0)),
        low_stock_threshold: Math.max(0, Math.round(d.low_stock_threshold || 0)),
        product_status: d.product_status,
        sort_order: d.sort_order,
        weight_grams: Math.max(0, Math.round(d.weight_grams || 0)),
        length_cm: Math.max(0, Number(d.length_cm || 0)),
        width_cm: Math.max(0, Number(d.width_cm || 0)),
        height_cm: Math.max(0, Number(d.height_cm || 0)),
        fragile: d.fragile,
        special_packaging: d.special_packaging,
        shipping_class: d.shipping_class || "standard",
        free_shipping_eligible: d.free_shipping_eligible,
      };
      if (d.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setDraft(null);
      toast.success("Product saved.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save."),
  });

  const archive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("products").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(variables.active ? "Product restored." : "Product archived.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update product."),
  });

  const adjustStock = useMutation({
    mutationFn: async ({ productId, quantity, movementType, note }: {
      productId: string;
      quantity: number;
      movementType: string;
      note?: string;
    }) => {
      if (!session?.access_token) throw new Error("Please sign in again.");
      await adjustInventoryStockFn({
        data: {
          productId,
          quantity,
          movementType,
          note,
          accessToken: session.access_token,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Stock adjusted and logged.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not adjust stock."),
  });

  const bulkProducts = useMutation({
    mutationFn: async ({ active, product_status }: { active?: boolean; product_status?: string }) => {
      const payload: Record<string, unknown> = {};
      if (active !== undefined) payload.active = active;
      if (product_status) payload.product_status = product_status;
      const { error } = await supabase.from("products").update(payload).in("id", selectedProducts);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setSelectedProducts([]);
      toast.success("Products updated.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Bulk update failed."),
  });

  const handleUpload = async (file: File) => {
    if (!draft) return;
    setUploading(true);
    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("Please upload an image file.");
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Image must be 5MB or smaller.");
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `products/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, file, { cacheControl: "31536000", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setDraft({ ...draft, image_url: data.publicUrl });
      toast.success("Image uploaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex justify-end">
        <button
          onClick={() => exportInventoryCsv(products)}
          className="mr-2 inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-xs uppercase tracking-[0.2em]"
        >
          <Download size={14} /> Export inventory
        </button>
        <button
          onClick={() => setDraft(emptyDraft())}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground"
        >
          <Plus size={14} /> Add product
        </button>
      </div>

      {selectedProducts.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-sm border border-border p-3">
          <span className="text-xs text-muted-foreground">{selectedProducts.length} selected</span>
          <button
            onClick={() => bulkProducts.mutate({ active: false, product_status: "archived" })}
            className="rounded-full border border-border px-3 py-1.5 text-xs"
          >
            Archive
          </button>
          <button
            onClick={() => bulkProducts.mutate({ active: true, product_status: "active" })}
            className="rounded-full border border-border px-3 py-1.5 text-xs"
          >
            Restore
          </button>
          <button
            onClick={() => bulkProducts.mutate({ active: true })}
            className="rounded-full border border-border px-3 py-1.5 text-xs"
          >
            Activate
          </button>
          <button
            onClick={() => bulkProducts.mutate({ active: false, product_status: "inactive" })}
            className="rounded-full border border-border px-3 py-1.5 text-xs"
          >
            Deactivate
          </button>
          <button
            onClick={() => {
              const qty = Number(prompt("Adjust selected product stock by quantity. Use negative numbers to reduce.") || 0);
              if (!qty) return;
              selectedProducts.forEach((productId) =>
                adjustStock.mutate({ productId, quantity: qty, movementType: "bulk_adjustment", note: "Bulk adjustment" }),
              );
            }}
            className="rounded-full border border-border px-3 py-1.5 text-xs"
          >
            Adjust Stock
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-sm border border-border">
              <div className="aspect-[4/3] bg-secondary">
                {p.image_url && (
                  <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedProducts.includes(p.id)}
                    onChange={(e) =>
                      setSelectedProducts((current) =>
                        e.target.checked ? [...current, p.id] : current.filter((id) => id !== p.id),
                      )
                    }
                    aria-label={`Select ${p.name}`}
                    className="mt-1"
                  />
                  <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                    {p.category} {!p.active ? "· Archived" : !p.in_stock && "· Sold out"}
                  </p>
                </div>
                <h3 className="mt-1 font-display text-lg">{p.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {inr(p.price)} · Stock: {p.stock}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reserved: {p.reserved_stock ?? 0} · Sold: {p.sold_stock ?? 0} · Damaged: {p.damaged_stock ?? 0} · Returned: {p.returned_stock ?? 0}
                </p>
                {p.stock <= (p.low_stock_threshold ?? 5) && (
                  <p className="mt-1 text-xs font-medium text-primary">
                    Low stock alert: threshold {p.low_stock_threshold ?? 5}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      setDraft({
                        ...p,
                        active: p.active ?? true,
                        tag: p.tag ?? "",
                        description: p.description ?? "",
                        low_stock_threshold: p.low_stock_threshold ?? 5,
                        product_status: p.product_status ?? (p.active ? "active" : "archived"),
                        weight_grams: p.weight_grams ?? 500,
                        length_cm: p.length_cm ?? 0,
                        width_cm: p.width_cm ?? 0,
                        height_cm: p.height_cm ?? 0,
                        fragile: p.fragile ?? false,
                        special_packaging: p.special_packaging ?? false,
                        shipping_class: p.shipping_class ?? "standard",
                        free_shipping_eligible: p.free_shipping_eligible ?? true,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    onClick={() => setVariantsFor(p)}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs"
                  >
                    <Layers size={13} /> Variants
                  </button>
                  <button
                    onClick={() => archive.mutate({ id: p.id, active: !p.active })}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs"
                  >
                    {p.active ? <Archive size={13} /> : <RotateCcw size={13} />}
                    {p.active ? "Archive" : "Restore"}
                  </button>
                  <button
                    onClick={() => {
                      const quantity = Number(prompt("Stock adjustment quantity. Use negative numbers to reduce.") || 0);
                      if (!quantity) return;
                      const movementType = prompt("Movement type", quantity > 0 ? "restock" : "adjustment") || "adjustment";
                      const note = prompt("Note") || "";
                      adjustStock.mutate({ productId: p.id, quantity, movementType, note });
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs"
                  >
                    Adjust stock
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4">
          <div className="my-8 w-full max-w-lg rounded-sm border border-border bg-background p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">{draft.id ? "Edit product" : "New product"}</h2>
              <button onClick={() => setDraft(null)} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <Field label="Name">
                <input
                  className={inputCls}
                  value={draft.name}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      name: e.target.value,
                      slug: draft.id ? draft.slug : slugify(e.target.value),
                    })
                  }
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Category">
                  <select
                    className={inputCls}
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Price (₹)">
                  <input
                    type="number"
                    className={inputCls}
                    value={draft.price}
                    onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                  />
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  rows={3}
                  className={inputCls}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Tag (e.g. New)">
                  <input
                    className={inputCls}
                    value={draft.tag}
                    onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
                  />
                </Field>
                <Field label="Stock count (base — ignored if variants exist)">
                  <input
                    type="number"
                    min={0}
                    className={inputCls}
                    value={draft.stock}
                    onChange={(e) => setDraft({ ...draft, stock: Number(e.target.value) })}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Low stock threshold">
                  <input
                    type="number"
                    min={0}
                    className={inputCls}
                    value={draft.low_stock_threshold}
                    onChange={(e) => setDraft({ ...draft, low_stock_threshold: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Product status">
                  <select
                    className={inputCls}
                    value={draft.product_status}
                    onChange={(e) => setDraft({ ...draft, product_status: e.target.value })}
                  >
                    {["active", "inactive", "draft", "archived", "out_of_stock", "hidden"].map((status) => (
                      <option key={status} value={status}>{statusLabel(status)}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Display order">
                  <input
                    type="number"
                    className={inputCls}
                    value={draft.sort_order}
                    onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
                  />
                </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Weight (grams)">
                  <input
                    type="number"
                    min={0}
                    className={inputCls}
                    value={draft.weight_grams}
                    onChange={(e) => setDraft({ ...draft, weight_grams: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Shipping class">
                  <select
                    className={inputCls}
                    value={draft.shipping_class}
                    onChange={(e) => setDraft({ ...draft, shipping_class: e.target.value })}
                  >
                    {["standard", "light", "fragile", "bulky", "express_only"].map((shippingClass) => (
                      <option key={shippingClass} value={shippingClass}>{statusLabel(shippingClass)}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Field label="Length (cm)">
                  <input
                    type="number"
                    min={0}
                    className={inputCls}
                    value={draft.length_cm}
                    onChange={(e) => setDraft({ ...draft, length_cm: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Width (cm)">
                  <input
                    type="number"
                    min={0}
                    className={inputCls}
                    value={draft.width_cm}
                    onChange={(e) => setDraft({ ...draft, width_cm: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Height (cm)">
                  <input
                    type="number"
                    min={0}
                    className={inputCls}
                    value={draft.height_cm}
                    onChange={(e) => setDraft({ ...draft, height_cm: Number(e.target.value) })}
                  />
                </Field>
              </div>

              <Field label="Product photo">
                <div className="flex items-center gap-4">
                  <div className="h-20 w-16 shrink-0 overflow-hidden rounded-sm border border-border bg-secondary">
                    {draft.image_url && (
                      <img src={draft.image_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.2em]">
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploading ? "Uploading…" : "Upload image"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(f);
                      }}
                    />
                  </label>
                </div>
              </Field>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                />
                Active on storefront
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.in_stock}
                  onChange={(e) => setDraft({ ...draft, in_stock: e.target.checked })}
                />
                Available for purchase
              </label>

              <div className="grid gap-2 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.fragile}
                    onChange={(e) => setDraft({ ...draft, fragile: e.target.checked })}
                  />
                  Fragile
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.special_packaging}
                    onChange={(e) => setDraft({ ...draft, special_packaging: e.target.checked })}
                  />
                  Special packaging
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.free_shipping_eligible}
                    onChange={(e) => setDraft({ ...draft, free_shipping_eligible: e.target.checked })}
                  />
                  Free shipping eligible
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDraft(null)}
                className="rounded-full border border-border px-5 py-2.5 text-xs uppercase tracking-[0.2em]"
              >
                Cancel
              </button>
              <button
                disabled={save.isPending || !draft.name}
                onClick={() => save.mutate(draft)}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-60"
              >
                {save.isPending && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {variantsFor && (
        <VariantsEditor product={variantsFor} onClose={() => setVariantsFor(null)} />
      )}
    </div>
  );
}

type LookbookDraft = {
  id?: string;
  title: string;
  caption: string;
  image_url: string;
  active: boolean;
  sort_order: number;
};

const emptyLookbookDraft = (): LookbookDraft => ({
  title: "",
  caption: "",
  image_url: "",
  active: true,
  sort_order: 0,
});

function LookbookAdmin() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<LookbookDraft | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-lookbook-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lookbook_items")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LookbookItem[];
    },
  });

  const save = useMutation({
    mutationFn: async (d: LookbookDraft) => {
      const payload = {
        title: d.title.trim(),
        caption: d.caption.trim(),
        image_url: d.image_url,
        active: d.active,
        sort_order: Math.round(d.sort_order || 0),
      };
      if (!payload.image_url) throw new Error("Upload an image before saving.");
      if (d.id) {
        const { error } = await supabase.from("lookbook_items").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lookbook_items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-lookbook-items"] });
      qc.invalidateQueries({ queryKey: ["lookbook-items"] });
      setDraft(null);
      toast.success("Lookbook image saved.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save image."),
  });

  const archive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("lookbook_items").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["admin-lookbook-items"] });
      qc.invalidateQueries({ queryKey: ["lookbook-items"] });
      toast.success(variables.active ? "Lookbook image restored." : "Lookbook image hidden.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update image."),
  });

  const handleUpload = async (file: File) => {
    if (!draft) return;
    setUploading(true);
    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("Please upload an image file.");
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Image must be 5MB or smaller.");
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `lookbook/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("lookbook-images")
        .upload(path, file, { cacheControl: "31536000", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("lookbook-images").getPublicUrl(path);
      setDraft({ ...draft, image_url: data.publicUrl });
      toast.success("Image uploaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex justify-end">
        <button
          onClick={() => setDraft(emptyLookbookDraft())}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground"
        >
          <Plus size={14} /> Add lookbook image
        </button>
      </div>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No lookbook images yet.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-sm border border-border">
              <div className="aspect-[4/3] bg-secondary">
                <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
              </div>
              <div className="p-4">
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                  Order {item.sort_order} {!item.active && "· Hidden"}
                </p>
                <h3 className="mt-1 font-display text-lg">{item.title || "Untitled image"}</h3>
                {item.caption && <p className="mt-1 text-sm text-muted-foreground">{item.caption}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      setDraft({
                        id: item.id,
                        title: item.title,
                        caption: item.caption,
                        image_url: item.image_url,
                        active: item.active,
                        sort_order: item.sort_order,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    onClick={() => archive.mutate({ id: item.id, active: !item.active })}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs"
                  >
                    {item.active ? <Archive size={13} /> : <RotateCcw size={13} />}
                    {item.active ? "Hide" : "Restore"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4">
          <div className="my-8 w-full max-w-lg rounded-sm border border-border bg-background p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">
                {draft.id ? "Edit lookbook image" : "New lookbook image"}
              </h2>
              <button onClick={() => setDraft(null)} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <Field label="Title">
                <input
                  className={inputCls}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </Field>
              <Field label="Caption">
                <textarea
                  rows={3}
                  className={inputCls}
                  value={draft.caption}
                  onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
                />
              </Field>
              <Field label="Display order">
                <input
                  type="number"
                  className={inputCls}
                  value={draft.sort_order}
                  onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
                />
              </Field>
              <Field label="Lookbook image">
                <div className="flex items-center gap-4">
                  <div className="h-20 w-16 shrink-0 overflow-hidden rounded-sm border border-border bg-secondary">
                    {draft.image_url && (
                      <img src={draft.image_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.2em]">
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploading ? "Uploading…" : "Upload image"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(f);
                      }}
                    />
                  </label>
                </div>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                />
                Active on lookbook
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDraft(null)}
                className="rounded-full border border-border px-5 py-2.5 text-xs uppercase tracking-[0.2em]"
              >
                Cancel
              </button>
              <button
                disabled={save.isPending || !draft.image_url}
                onClick={() => save.mutate(draft)}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-60"
              >
                {save.isPending && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsAdmin() {
  const qc = useQueryClient();
  const { session, user } = useAuth();
  const { settings: liveSettings } = useBusinessSettings();
  const sendBrevoTestEmailFn = useServerFn(sendBrevoTestEmail);
  const checkBrevoConnectionFn = useServerFn(checkBrevoConnection);
  const sendNewsletterCampaignFn = useServerFn(sendNewsletterCampaign);
  const [draft, setDraft] = useState<BusinessSettings>({ ...DEFAULT_BUSINESS_SETTINGS });
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>("store");
  const [dirty, setDirty] = useState(false);
  const [testEmail, setTestEmail] = useState(user?.email || "superbcreations55@gmail.com");

  const { isLoading } = useQuery({
    queryKey: ["admin-business-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("business_settings").select("key,value");
      if (error) throw error;
      const settings = (data ?? []).reduce(
        (acc, row) => (row.key in acc ? { ...acc, [row.key]: row.value } : acc),
        { ...DEFAULT_BUSINESS_SETTINGS } as BusinessSettings,
      );
      setDraft(settings);
      setDirty(false);
      return settings;
    },
  });

  const save = useMutation({
    mutationFn: async (settings: BusinessSettings) => {
      const rows = businessSettingRows(settings);
      const { error } = await supabase.from("business_settings").upsert(rows, {
        onConflict: "key",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-business-settings"] });
      qc.invalidateQueries({ queryKey: ["business-settings"] });
      setDirty(false);
      toast.success("Settings saved.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save settings."),
  });

  const testEmailMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token) throw new Error("Please sign in again.");
      return sendBrevoTestEmailFn({
        data: { accessToken: session.access_token, to: testEmail },
      });
    },
    onSuccess: () => toast.success("Test email request completed. Check Email Logs for delivery status."),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send test email."),
  });

  const connectionMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token) throw new Error("Please sign in again.");
      return checkBrevoConnectionFn({ data: { accessToken: session.access_token } });
    },
    onSuccess: (result: any) =>
      result?.ok ? toast.success("Brevo connection verified.") : toast.error(result?.error || "Brevo connection failed."),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Brevo connection failed."),
  });

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const set = (key: keyof BusinessSettings, value: string) => {
    setDirty(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const section = settingsSections.find((s) => s.key === activeSection) ?? settingsSections[0];

  if (isLoading) return <p className="mt-8 text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="h-fit rounded-sm border border-border p-3">
        {settingsSections.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActiveSection(s.key)}
            className={
              "block w-full rounded-sm px-3 py-2 text-left text-sm transition-colors " +
              (activeSection === s.key ? "bg-secondary font-medium" : "text-muted-foreground")
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="rounded-sm border border-border p-5">
        <SettingsDebugPanel settings={liveSettings} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">{section.label}</h2>
            {dirty && <p className="mt-1 text-xs text-muted-foreground">Unsaved changes</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!dirty || save.isPending}
              onClick={() => {
                setDraft({ ...DEFAULT_BUSINESS_SETTINGS });
                setDirty(true);
              }}
              className="rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.18em] disabled:opacity-50"
            >
              Reset defaults
            </button>
            <button
              disabled={save.isPending}
              onClick={() => save.mutate(draft)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-60"
            >
              {save.isPending && <Loader2 size={14} className="animate-spin" />} Save settings
            </button>
          </div>
        </div>

        {activeSection === "media" ? (
          <MediaLibraryPanel settings={draft} onUseUrl={(key, url) => set(key, url)} />
        ) : activeSection === "email" ? (
          <>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {section.fields.map((field) => (
                <SettingField
                  key={field.key}
                  field={field}
                  value={draft[field.key]}
                  onChange={(value) => set(field.key, value)}
                />
              ))}
            </div>
            <EmailOpsPanel
              testEmail={testEmail}
              setTestEmail={setTestEmail}
              onTest={() => testEmailMutation.mutate()}
              onCheck={() => connectionMutation.mutate()}
              sendCampaignFn={sendNewsletterCampaignFn}
              accessToken={session?.access_token}
              busy={testEmailMutation.isPending || connectionMutation.isPending}
            />
          </>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {section.fields.map((field) => (
              <SettingField
                key={field.key}
                field={field}
                value={draft[field.key]}
                onChange={(value) => set(field.key, value)}
              />
            ))}
          </div>
        )}

        {activeSection !== "media" && (
          <div className="mt-6 flex justify-end">
            <button
              disabled={save.isPending || !dirty}
              onClick={() => save.mutate(draft)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-60"
            >
              {save.isPending && <Loader2 size={14} className="animate-spin" />} Save settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsDebugPanel({ settings }: { settings: BusinessSettings }) {
  const rows: Array<[string, string]> = [
    ["contact_email", settings.contact_email],
    ["facebook_url", settings.facebook_url],
    ["show_facebook", settings.show_facebook],
    ["logo_url", settings.logo_url],
    ["address", settings.address],
    ["business_hours", settings.business_hours],
    ["supabase_project_ref", supabaseProjectRefFromUrl()],
  ];

  return (
    <div className="mb-5 rounded-sm border border-border bg-secondary/30 p-4">
      <p className="eyebrow">Settings Debug</p>
      <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-words text-foreground">{value || "Not set"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

type SettingsSectionKey =
  | "store"
  | "contact"
  | "social"
  | "homepage"
  | "media"
  | "shipping"
  | "payments"
  | "policies"
  | "seo"
  | "email";

type SettingFieldConfig = {
  key: keyof BusinessSettings;
  label: string;
  type?: "text" | "email" | "url" | "number" | "color" | "textarea" | "toggle" | "password";
  span?: boolean;
};

const settingsSections: Array<{
  key: SettingsSectionKey;
  label: string;
  fields: SettingFieldConfig[];
}> = [
  {
    key: "store",
    label: "Store",
    fields: [
      { key: "store_name", label: "Store name" },
      { key: "business_name", label: "Legal/business name" },
      { key: "logo_url", label: "Logo URL", type: "url", span: true },
      { key: "favicon_url", label: "Favicon URL", type: "url", span: true },
      { key: "primary_color", label: "Primary color", type: "color" },
      { key: "secondary_color", label: "Secondary color", type: "color" },
      { key: "store_status", label: "Store status" },
      { key: "maintenance_mode", label: "Maintenance mode", type: "toggle" },
      { key: "maintenance_message", label: "Maintenance message", type: "textarea", span: true },
      { key: "copyright_text", label: "Copyright text", span: true },
    ],
  },
  {
    key: "contact",
    label: "Contact",
    fields: [
      { key: "contact_email", label: "Contact email", type: "email" },
      { key: "phone_number", label: "Phone display" },
      { key: "whatsapp_number", label: "WhatsApp number" },
      { key: "address", label: "Address", span: true },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "country", label: "Country" },
      { key: "pincode", label: "Pincode" },
      { key: "google_maps_link", label: "Google Maps link", type: "url", span: true },
      { key: "business_hours", label: "Business hours" },
      { key: "emergency_contact", label: "Emergency contact" },
    ],
  },
  {
    key: "social",
    label: "Social",
    fields: [
      { key: "instagram_url", label: "Instagram URL", type: "url", span: true },
      { key: "facebook_url", label: "Facebook URL", type: "url", span: true },
      { key: "youtube_url", label: "YouTube URL", type: "url", span: true },
      { key: "pinterest_url", label: "Pinterest URL", type: "url", span: true },
      { key: "x_url", label: "X URL", type: "url", span: true },
      { key: "linkedin_url", label: "LinkedIn URL", type: "url", span: true },
      { key: "threads_url", label: "Threads URL", type: "url", span: true },
      { key: "website_url", label: "Website URL", type: "url", span: true },
      { key: "show_instagram", label: "Show Instagram", type: "toggle" },
      { key: "show_facebook", label: "Show Facebook", type: "toggle" },
      { key: "show_youtube", label: "Show YouTube", type: "toggle" },
      { key: "show_pinterest", label: "Show Pinterest", type: "toggle" },
      { key: "show_x", label: "Show X", type: "toggle" },
      { key: "show_linkedin", label: "Show LinkedIn", type: "toggle" },
      { key: "show_threads", label: "Show Threads", type: "toggle" },
      { key: "show_website", label: "Show website", type: "toggle" },
    ],
  },
  {
    key: "homepage",
    label: "Homepage",
    fields: [
      { key: "hero_eyebrow", label: "Hero eyebrow" },
      { key: "hero_title", label: "Hero title" },
      { key: "hero_subtitle", label: "Hero subtitle" },
      { key: "hero_description", label: "Hero description", type: "textarea", span: true },
      { key: "hero_button_text", label: "Hero button text" },
      { key: "hero_button_link", label: "Hero button link" },
      { key: "announcement_bar", label: "Announcement bar", type: "textarea", span: true },
      { key: "announcement_color", label: "Announcement color", type: "color" },
      { key: "homepage_banner_url", label: "Homepage banner URL", type: "url", span: true },
      { key: "featured_collection_title", label: "Featured title" },
      { key: "featured_collection_description", label: "Featured description", type: "textarea", span: true },
      { key: "lookbook_title", label: "Lookbook title" },
      { key: "lookbook_description", label: "Lookbook description", type: "textarea", span: true },
    ],
  },
  {
    key: "media",
    label: "Media Library",
    fields: [],
  },
  {
    key: "shipping",
    label: "Shipping & Fulfillment",
    fields: [
      { key: "standard_shipping_enabled", label: "Standard shipping enabled", type: "toggle" },
      { key: "flat_shipping", label: "Standard shipping fee", type: "number" },
      { key: "standard_delivery_estimate", label: "Standard delivery estimate text" },
      { key: "express_shipping", label: "Express shipping enabled", type: "toggle" },
      { key: "express_shipping_fee", label: "Express shipping fee", type: "number" },
      { key: "express_delivery_estimate", label: "Express delivery estimate text" },
      { key: "free_shipping_threshold", label: "Free shipping threshold", type: "number" },
      { key: "packaging_charge", label: "Packaging charge", type: "number" },
      { key: "cod_available", label: "COD available", type: "toggle" },
      { key: "default_shipping_provider", label: "Default provider" },
      { key: "shipping_mode", label: "Shipping mode" },
      { key: "enable_shiprocket", label: "Enable Shiprocket", type: "toggle" },
      { key: "enable_delhivery", label: "Enable Delhivery", type: "toggle" },
      { key: "enable_india_post", label: "Enable India Post", type: "toggle" },
      { key: "enable_blue_dart", label: "Enable Blue Dart", type: "toggle" },
      { key: "estimated_delivery", label: "Estimated delivery" },
      { key: "estimated_delivery_days", label: "Estimated delivery days" },
      { key: "shipping_insurance", label: "Shipping insurance", type: "toggle" },
      { key: "international_shipping", label: "International shipping", type: "toggle" },
      { key: "tax_percentage", label: "Tax percentage", type: "number" },
      { key: "pickup_address", label: "Pickup address", type: "textarea", span: true },
      { key: "return_address", label: "Return address", type: "textarea", span: true },
      { key: "shipping_support_contact", label: "Shipping support contact", span: true },
      { key: "shiprocket_api_key", label: "Shiprocket API key (leave blank to keep current)", type: "password", span: true },
      { key: "delhivery_api_key", label: "Delhivery API key (leave blank to keep current)", type: "password", span: true },
      { key: "blue_dart_api_key", label: "Blue Dart API key (leave blank to keep current)", type: "password", span: true },
      { key: "india_post_customer_id", label: "India Post customer ID", span: true },
    ],
  },
  {
    key: "payments",
    label: "Payments",
    fields: [
      { key: "enable_checkout", label: "Enable checkout", type: "toggle" },
      { key: "enable_orders", label: "Enable orders", type: "toggle" },
      { key: "enable_whatsapp", label: "Enable WhatsApp orders", type: "toggle" },
      { key: "enable_upi", label: "Enable UPI", type: "toggle" },
      { key: "enable_razorpay", label: "Enable Razorpay", type: "toggle" },
      { key: "enable_cod", label: "Enable COD", type: "toggle" },
      { key: "enable_reviews", label: "Enable reviews", type: "toggle" },
      { key: "enable_wishlist", label: "Enable wishlist", type: "toggle" },
      { key: "enable_newsletter", label: "Enable newsletter", type: "toggle" },
      { key: "upi_id", label: "UPI ID" },
      { key: "merchant_name", label: "Merchant name" },
      { key: "payment_note", label: "Payment note" },
      { key: "payment_timeout_minutes", label: "UPI timeout minutes", type: "number" },
    ],
  },
  {
    key: "policies",
    label: "Policies",
    fields: [
      { key: "privacy_policy", label: "Privacy Policy", type: "textarea", span: true },
      { key: "terms_policy", label: "Terms & Conditions", type: "textarea", span: true },
      { key: "shipping_policy", label: "Shipping Policy", type: "textarea", span: true },
      { key: "return_refund_policy", label: "Return/Refund Policy", type: "textarea", span: true },
      { key: "support_policy", label: "Contact/Support Policy", type: "textarea", span: true },
    ],
  },
  {
    key: "seo",
    label: "SEO",
    fields: [
      { key: "website_title", label: "Website title", span: true },
      { key: "website_description", label: "Meta description", type: "textarea", span: true },
      { key: "seo_keywords", label: "SEO keywords", type: "textarea", span: true },
      { key: "og_image_url", label: "Open Graph image URL", type: "url", span: true },
      { key: "twitter_image_url", label: "Twitter image URL", type: "url", span: true },
      { key: "robots_index", label: "Allow search indexing", type: "toggle" },
      { key: "google_verification_code", label: "Google verification code" },
      { key: "google_analytics_id", label: "Google Analytics ID" },
      { key: "meta_pixel_id", label: "Meta Pixel ID" },
      { key: "canonical_url", label: "Canonical URL", type: "url", span: true },
    ],
  },
  {
    key: "email",
    label: "Email",
    fields: [
      { key: "email_sender_name", label: "Sender name" },
      { key: "email_sender_email", label: "Sender email", type: "email" },
      { key: "email_reply_to", label: "Reply-to email", type: "email" },
      { key: "support_email", label: "Support email", type: "email" },
      { key: "business_email", label: "Business/admin email", type: "email" },
      { key: "enable_email_sending", label: "Enable Brevo email sending", type: "toggle" },
      { key: "brevo_contacts_enabled", label: "Sync Brevo contacts", type: "toggle" },
      { key: "brevo_api_key", label: "Brevo API key (leave blank to keep current)", type: "password", span: true },
      { key: "email_company_address", label: "Company address", type: "textarea", span: true },
      { key: "email_footer", label: "Email footer", type: "textarea", span: true },
      { key: "email_logo_url", label: "Email logo URL", type: "url", span: true },
      { key: "email_primary_color", label: "Email primary color", type: "color" },
      { key: "email_secondary_color", label: "Email secondary color", type: "color" },
      { key: "max_upload_size_mb", label: "Max upload size MB", type: "number" },
    ],
  },
];

function SettingField({
  field,
  value,
  onChange,
}: {
  field: SettingFieldConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === "toggle") {
    return (
      <label className={"flex items-center gap-3 rounded-sm border border-border p-3 text-sm " + (field.span ? "sm:col-span-2" : "")}>
        <input
          type="checkbox"
          checked={value === "true"}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
        />
        {field.label}
      </label>
    );
  }

  return (
    <Field label={field.label}>
      {field.type === "textarea" ? (
        <textarea
          rows={field.key.toString().includes("policy") ? 8 : 4}
          className={inputCls + (field.span ? " sm:col-span-2" : "")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type={field.type || "text"}
          className={inputCls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

function EmailOpsPanel({
  testEmail,
  setTestEmail,
  onTest,
  onCheck,
  sendCampaignFn,
  accessToken,
  busy,
}: {
  testEmail: string;
  setTestEmail: (value: string) => void;
  onTest: () => void;
  onCheck: () => void;
  sendCampaignFn: (args: { data: { accessToken: string; campaignId: string } }) => Promise<unknown>;
  accessToken?: string;
  busy: boolean;
}) {
  const db = supabase as any;
  const qc = useQueryClient();
  const [campaignDraft, setCampaignDraft] = useState({
    name: "",
    subject: "",
    body_html: "",
    audience: "newsletter",
  });
  const { data: logs = [] } = useQuery({
    queryKey: ["admin-email-logs"],
    queryFn: async () => {
      const { data, error } = await db
        .from("email_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["admin-email-templates"],
    queryFn: async () => {
      const { data, error } = await db
        .from("email_templates")
        .select("*")
        .order("category")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: campaigns = [] } = useQuery({
    queryKey: ["admin-newsletter-campaigns"],
    queryFn: async () => {
      const { data, error } = await db
        .from("newsletter_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  const saveCampaign = useMutation({
    mutationFn: async () => {
      if (!campaignDraft.name.trim() || !campaignDraft.subject.trim()) {
        throw new Error("Campaign name and subject are required.");
      }
      const { error } = await db.from("newsletter_campaigns").insert({
        name: campaignDraft.name.trim(),
        subject: campaignDraft.subject.trim(),
        body_html: campaignDraft.body_html,
        audience: campaignDraft.audience,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-newsletter-campaigns"] });
      setCampaignDraft({ name: "", subject: "", body_html: "", audience: "newsletter" });
      toast.success("Campaign saved.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save campaign."),
  });
  const sendCampaign = useMutation({
    mutationFn: async (campaignId: string) => {
      if (!accessToken) throw new Error("Please sign in again.");
      return sendCampaignFn({ data: { accessToken, campaignId } });
    },
    onSuccess: (result: any) => {
      qc.invalidateQueries({ queryKey: ["admin-newsletter-campaigns"] });
      qc.invalidateQueries({ queryKey: ["admin-email-logs"] });
      toast.success(`Campaign sent to ${result?.sent ?? 0} subscribers.`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send campaign."),
  });
  const sent = logs.filter((log: any) => log.status === "sent").length;
  const failed = logs.filter((log: any) => log.status === "failed").length;
  const delivered = logs.filter((log: any) => log.delivered_at).length;
  const opened = logs.filter((log: any) => log.opened_at).length;
  const clicked = logs.filter((log: any) => log.clicked_at).length;
  const rate = (value: number) => (logs.length ? `${Math.round((value / logs.length) * 100)}%` : "0%");

  return (
    <div className="mt-6 space-y-6 border-t border-border pt-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Sent", sent],
          ["Failed", failed],
          ["Delivered", rate(delivered)],
          ["Open Rate", rate(opened)],
          ["Click Rate", rate(clicked)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-sm border border-border p-3">
            <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-sm border border-border p-4">
        <h3 className="font-display text-xl">Brevo testing</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input
            type="email"
            className={inputCls}
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Test recipient"
          />
          <button
            type="button"
            disabled={busy}
            onClick={onCheck}
            className="rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.18em] disabled:opacity-50"
          >
            Check Brevo
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onTest}
            className="rounded-full bg-primary px-4 py-2 text-xs uppercase tracking-[0.18em] text-primary-foreground disabled:opacity-50"
          >
            Send Test
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-sm border border-border p-4">
          <h3 className="font-display text-xl">Newsletter campaign</h3>
          <div className="mt-3 grid gap-3">
            <input className={inputCls} placeholder="Campaign name" value={campaignDraft.name} onChange={(e) => setCampaignDraft({ ...campaignDraft, name: e.target.value })} />
            <input className={inputCls} placeholder="Subject" value={campaignDraft.subject} onChange={(e) => setCampaignDraft({ ...campaignDraft, subject: e.target.value })} />
            <select className={inputCls} value={campaignDraft.audience} onChange={(e) => setCampaignDraft({ ...campaignDraft, audience: e.target.value })}>
              {["newsletter", "customers", "vip", "loyalty", "wishlist", "inactive"].map((audience) => (
                <option key={audience} value={audience}>{statusLabel(audience)}</option>
              ))}
            </select>
            <textarea className={inputCls} rows={5} placeholder="Campaign HTML/body" value={campaignDraft.body_html} onChange={(e) => setCampaignDraft({ ...campaignDraft, body_html: e.target.value })} />
            <button type="button" onClick={() => saveCampaign.mutate()} className="rounded-full bg-primary px-4 py-2 text-xs uppercase tracking-[0.18em] text-primary-foreground">
              Save Campaign
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {campaigns.map((campaign: any) => (
              <div key={campaign.id} className="rounded-sm border border-border p-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-muted-foreground">{campaign.subject} · {campaign.status}</p>
                  </div>
                  {campaign.status !== "sent" && (
                    <button
                      type="button"
                      onClick={() => sendCampaign.mutate(campaign.id)}
                      className="rounded-full border border-border px-3 py-1.5"
                    >
                      Send
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-sm border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-xl">Template preview</h3>
            <span className="text-xs text-muted-foreground">{templates.length} templates</span>
          </div>
          <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">
            {templates.map((template: any) => (
              <details key={template.key} className="rounded-sm border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">{template.name}</summary>
                <p className="mt-2 text-xs text-muted-foreground">{template.subject}</p>
                <div className="mt-2 rounded-sm bg-secondary/30 p-3 text-xs" dangerouslySetInnerHTML={{ __html: template.body_html }} />
              </details>
            ))}
          </div>
        </div>

        <div className="rounded-sm border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-xl">Email logs</h3>
            <button
              type="button"
              onClick={() =>
                downloadCsv("email-logs.csv", [
                  ["Time", "Recipient", "Template", "Status", "Subject", "Error"],
                  ...logs.map((log: any) => [log.created_at, log.recipient, log.template_key, log.status, log.subject, log.error]),
                ])
              }
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs"
            >
              <Download size={12} /> Export
            </button>
          </div>
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {logs.map((log: any) => (
              <div key={log.id} className="rounded-sm border border-border p-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{log.recipient}</p>
                  <span className="uppercase tracking-[0.14em] text-muted-foreground">{log.status}</span>
                </div>
                <p className="mt-1 text-muted-foreground">{log.template_key || "custom"} · {log.subject}</p>
                {log.error && <p className="mt-1 text-destructive">{log.error}</p>}
              </div>
            ))}
            {logs.length === 0 && <p className="text-sm text-muted-foreground">No email logs yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

type MediaLibraryRow = {
  id: string;
  name: string;
  url: string;
  folder: string;
  storage_path: string | null;
  size_bytes: number | null;
  mime_type: string | null;
};

function MediaLibraryPanel({
  settings,
  onUseUrl,
}: {
  settings: BusinessSettings;
  onUseUrl: (key: keyof BusinessSettings, url: string) => void;
}) {
  const qc = useQueryClient();
  const [folder, setFolder] = useState("site");
  const [uploading, setUploading] = useState(false);
  const { data: media = [], isLoading } = useQuery({
    queryKey: ["admin-media-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_library")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MediaLibraryRow[];
    },
  });

  const remove = useMutation({
    mutationFn: async (row: MediaLibraryRow) => {
      if (row.storage_path) {
        const { error: storageError } = await supabase.storage
          .from("business-media")
          .remove([row.storage_path]);
        if (storageError) throw storageError;
      }
      const { error } = await supabase.from("media_library").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-media-library"] });
      toast.success("Media removed.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove media."),
  });

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const maxMb = Number(settings.max_upload_size_mb || 5);
      if (!file.type.startsWith("image/")) throw new Error("Please upload an image file.");
      if (file.size > maxMb * 1024 * 1024) throw new Error(`Image must be ${maxMb}MB or smaller.`);
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${folder || "site"}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("business-media")
        .upload(path, file, { cacheControl: "31536000", upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("business-media").getPublicUrl(path);
      const { error } = await supabase.from("media_library").insert({
        name: file.name,
        url: data.publicUrl,
        folder: folder || "site",
        storage_path: path,
        size_bytes: file.size,
        mime_type: file.type,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["admin-media-library"] });
      toast.success("Media uploaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-end gap-3 rounded-sm border border-border p-4">
        <Field label="Folder">
          <input className={inputCls} value={folder} onChange={(e) => setFolder(e.target.value)} />
        </Field>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground">
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? "Uploading..." : "Upload image"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
            }}
          />
        </label>
      </div>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading media...</p>
      ) : media.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No media uploaded yet.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {media.map((row) => (
            <div key={row.id} className="overflow-hidden rounded-sm border border-border">
              <div className="aspect-[4/3] bg-secondary">
                <img src={row.url} alt={row.name} className="h-full w-full object-cover" />
              </div>
              <div className="space-y-3 p-3">
                <div>
                  <p className="truncate text-sm font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.folder}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["logo_url", "Use logo"],
                    ["homepage_banner_url", "Use banner"],
                    ["og_image_url", "Use OG"],
                    ["email_logo_url", "Use email"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        onUseUrl(key as keyof BusinessSettings, row.url);
                        toast.success(`${label} URL staged. Save settings to publish.`);
                      }}
                      className="rounded-full border border-border px-3 py-1.5 text-xs"
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(row.url).then(() => toast.success("URL copied."))}
                    className="rounded-full border border-border px-3 py-1.5 text-xs"
                  >
                    Copy URL
                  </button>
                  <button
                    type="button"
                    onClick={() => remove.mutate(row)}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-destructive"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type AnalyticsRangeKey = "today" | "7d" | "30d" | "this_month" | "last_month" | "custom";

const analyticsRangeOptions: Array<[AnalyticsRangeKey, string]> = [
  ["today", "Today"],
  ["7d", "Last 7 Days"],
  ["30d", "Last 30 Days"],
  ["this_month", "This Month"],
  ["last_month", "Last Month"],
  ["custom", "Custom"],
];

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function analyticsDateRange(range: AnalyticsRangeKey) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "today") return { from: formatDateInput(today), to: formatDateInput(today) };
  if (range === "7d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: formatDateInput(from), to: formatDateInput(today) };
  }
  if (range === "30d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return { from: formatDateInput(from), to: formatDateInput(today) };
  }
  if (range === "this_month") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: formatDateInput(from), to: formatDateInput(today) };
  }
  const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const to = new Date(today.getFullYear(), today.getMonth(), 0);
  return { from: formatDateInput(from), to: formatDateInput(to) };
}

function AnalyticsAdmin() {
  const db = supabase as any;
  const qc = useQueryClient();
  const { user } = useAuth();
  const [range, setRange] = useState<AnalyticsRangeKey>("30d");
  const initialRange = useMemo(() => analyticsDateRange("30d"), []);
  const [customFrom, setCustomFrom] = useState(initialRange.from);
  const [customTo, setCustomTo] = useState(initialRange.to);
  const selectedRange = range === "custom" ? { from: customFrom, to: customTo } : analyticsDateRange(range);

  const analytics = useQuery({
    queryKey: ["admin-analytics", selectedRange.from, selectedRange.to],
    queryFn: async () => {
      const args = { p_from: selectedRange.from, p_to: selectedRange.to };
      const results = await Promise.all([
        db.rpc("get_admin_analytics_summary", args),
        db.rpc("get_revenue_series", args),
        db.rpc("get_product_analytics", args),
        db.rpc("get_customer_analytics", args),
        db.rpc("get_inventory_analytics", args),
        db.rpc("get_payment_analytics", args),
        db.rpc("get_shipping_analytics", args),
        db.rpc("get_email_analytics", args),
        db.rpc("get_coupon_analytics", args),
        db.rpc("get_review_analytics", args),
      ]);
      for (const result of results) if (result.error) throw result.error;
      const [summary, revenue, products, customers, inventory, payments, shipping, email, coupons, reviews] = results;
      return {
        summary: summary.data ?? {},
        revenue: revenue.data ?? {},
        products: products.data ?? {},
        customers: customers.data ?? {},
        inventory: inventory.data ?? {},
        payments: payments.data ?? {},
        shipping: shipping.data ?? {},
        email: email.data ?? {},
        coupons: coupons.data ?? {},
        reviews: reviews.data ?? {},
      };
    },
  });

  const snapshot = useMutation({
    mutationFn: async () => {
      const { error } = await db.rpc("generate_daily_analytics_snapshot", {
        p_snapshot_date: selectedRange.to,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Daily analytics snapshot generated."),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Snapshot failed."),
  });

  const logExport = async (exportType: string, rowCount: number) => {
    await db.from("analytics_export_logs").insert({
      export_type: exportType,
      date_from: selectedRange.from,
      date_to: selectedRange.to,
      row_count: rowCount,
      actor_id: user?.id ?? null,
    });
    qc.invalidateQueries({ queryKey: ["admin-analytics"] });
  };

  const exportReport = async (type: string) => {
    const data = analytics.data;
    if (!data) return;
    const rows = analyticsExportRows(type, data);
    downloadCsv(`analytics-${type}-${selectedRange.from}-to-${selectedRange.to}.csv`, rows);
    await logExport(type, Math.max(0, rows.length - 1));
  };

  const data = analytics.data ?? {};
  const summary: any = data.summary ?? {};
  const conversion = summary.conversionIndicators ?? {};
  const series = data.revenue?.series ?? [];
  const products = data.products?.products ?? [];
  const customers = data.customers ?? {};
  const inventory = data.inventory ?? {};
  const payments = data.payments ?? {};
  const shipping = data.shipping ?? {};
  const email = data.email ?? {};
  const coupons = data.coupons ?? {};
  const reviews = data.reviews ?? {};

  if (analytics.isLoading) return <p className="mt-8 text-sm text-muted-foreground">Loading analytics...</p>;
  if (analytics.error) {
    return (
      <div className="mt-8 rounded-sm border border-destructive/30 p-4 text-sm text-destructive">
        {analytics.error instanceof Error ? analytics.error.message : "Analytics could not be loaded."}
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-sm border border-border p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Business intelligence</p>
            <h2 className="mt-1 font-display text-2xl">Analytics</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {analyticsRangeOptions.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setRange(key)}
                className={
                  "rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.16em] " +
                  (range === key ? "border-primary bg-primary text-primary-foreground" : "border-border")
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {range === "custom" && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="From">
              <input type="date" className={inputCls} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <input type="date" className={inputCls} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </Field>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {["summary", "revenue", "products", "customers", "inventory", "payments", "shipping", "coupons", "reviews", "emails", "full"].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => exportReport(type)}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs uppercase tracking-[0.14em]"
            >
              <Download size={12} /> {type}
            </button>
          ))}
          <button
            type="button"
            disabled={snapshot.isPending}
            onClick={() => snapshot.mutate()}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-primary-foreground disabled:opacity-60"
          >
            {snapshot.isPending ? <Loader2 size={12} className="animate-spin" /> : <BarChart3 size={12} />}
            Snapshot
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Revenue Today", inr(summary.revenueToday)],
          ["Revenue This Week", inr(summary.revenueWeek)],
          ["Revenue This Month", inr(summary.revenueMonth)],
          ["Revenue Lifetime", inr(summary.revenueLifetime)],
          ["Orders Today", summary.ordersToday],
          ["Orders Pending", summary.ordersPending],
          ["Orders Completed", summary.ordersCompleted],
          ["Orders Cancelled", summary.ordersCancelled],
          ["Average Order Value", inr(summary.averageOrderValue)],
          ["Pending UPI", summary.pendingUpiPayments],
          ["Pending Shipping", summary.pendingShipping],
          ["Low Stock Count", summary.lowStockCount],
          ["New Customers", summary.newCustomers],
          ["Repeat Customers", summary.repeatCustomers],
          ["Newsletter Subscribers", summary.newsletterSubscribers],
          ["Reviews Pending", summary.reviewsPending],
          ["Email Sent", summary.emailSentCount],
          ["Checkout Starts", conversion.checkoutStarted],
          ["Add To Cart", conversion.addToCart],
          ["Product Views", conversion.productViews],
        ].map(([label, value]) => (
          <div key={label} className="rounded-sm border border-border p-4">
            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-2xl">{value ?? 0}</p>
          </div>
        ))}
      </div>

      <AnalyticsPanel title="Sales Reports">
        <AnalyticsTable
          headers={["Date", "Revenue", "Orders", "AOV", "Refunds", "Cancelled", "Discount", "Shipping", "Packaging"]}
          rows={series.map((row: any) => [
            row.date,
            inr(row.revenue),
            row.orders,
            inr(row.averageOrderValue),
            row.refunds,
            row.cancelledOrders,
            inr(row.couponDiscountTotal),
            inr(row.shippingRevenue),
            inr(row.packagingRevenue),
          ])}
        />
        <MiniList
          title="Payment method split"
          rows={(data.revenue?.paymentMethodSplit ?? []).map((row: any) => `${statusLabel(row.method)}: ${row.orders} orders · ${inr(row.revenue)}`)}
        />
      </AnalyticsPanel>

      <AnalyticsPanel title="Product Analytics">
        <AnalyticsTable
          headers={["Product", "Revenue", "Sold", "Views", "Wishlist", "Rating", "Stock", "Return %"]}
          rows={products.slice(0, 25).map((p: any) => [p.name, inr(p.revenue), p.soldQuantity, p.views, p.wishlistCount, p.averageRating, p.stock, p.returnRate])}
        />
        <MiniList title="Low stock" rows={(data.products?.lowStockProducts ?? []).map((p: any) => `${p.name}: ${p.stock}/${p.threshold}`)} />
      </AnalyticsPanel>

      <div className="grid gap-6 xl:grid-cols-2">
        <AnalyticsPanel title="Customer Analytics">
          <MetricGrid rows={[
            ["Total Customers", customers.totalCustomers],
            ["New Customers", customers.newCustomers],
            ["Repeat Customers", customers.repeatCustomers],
            ["Wishlist Users", customers.wishlistUsers],
            ["Newsletter Subscribers", customers.newsletterSubscribers],
            ["Inactive Customers", customers.inactiveCustomers],
            ["Abandoned Cart Indicators", Math.max(0, Number(customers.abandonedCartIndicators || 0))],
          ]} />
          <MiniList title="Top customers by revenue" rows={(customers.topCustomersByRevenue ?? []).slice(0, 8).map((c: any) => `${c.name || c.email || c.userId}: ${inr(c.revenue)} · ${c.orders} orders`)} />
        </AnalyticsPanel>

        <AnalyticsPanel title="Inventory Analytics">
          <MetricGrid rows={[
            ["Available Stock Value", inr(inventory.availableStockValue)],
            ["Reserved Stock Value", inr(inventory.reservedStockValue)],
            ["Sold Stock Count", inventory.soldStockCount],
            ["Damaged Stock Count", inventory.damagedStockCount],
            ["Returned Stock Count", inventory.returnedStockCount],
            ["Low Stock Warnings", inventory.lowStockWarnings],
          ]} />
          <MiniList title="Recent movements" rows={(inventory.movementHistory ?? []).slice(0, 8).map((m: any) => `${statusLabel(m.type)}: ${m.quantity} · ${new Date(m.createdAt).toLocaleDateString("en-IN")}`)} />
        </AnalyticsPanel>

        <AnalyticsPanel title="Payment Analytics">
          <MetricGrid rows={[
            ["UPI Pending", payments.upiPending],
            ["UPI Submitted", payments.upiSubmitted],
            ["UPI Approved", payments.upiApproved],
            ["UPI Rejected", payments.upiRejected],
            ["Expired Payments", payments.expiredPayments],
            ["Duplicate UTR Attempts", payments.duplicateUtrAttempts],
            ["Approval Time Minutes", payments.paymentApprovalTimeMinutes],
          ]} />
        </AnalyticsPanel>

        <AnalyticsPanel title="Shipping Analytics">
          <MetricGrid rows={[
            ["Not Shipped", shipping.notShipped],
            ["Packed", shipping.packedOrders],
            ["Shipped", shipping.shippedOrders],
            ["Delivered", shipping.deliveredOrders],
            ["Delivery Failed", shipping.deliveryFailed],
            ["Returned To Origin", shipping.returnedToOrigin],
            ["Avg Dispatch Hours", shipping.averageDispatchTimeHours],
            ["Avg Delivery Hours", shipping.averageDeliveryTimeHours],
            ["Shipping Fees", inr(shipping.shippingFeeCollected)],
            ["Packaging Fees", inr(shipping.packagingFeeCollected)],
          ]} />
          <MiniList title="Courier performance" rows={(shipping.courierPerformance ?? []).map((c: any) => `${c.courier}: ${c.orders} orders · ${c.delivered} delivered · ${c.failed} failed`)} />
        </AnalyticsPanel>

        <AnalyticsPanel title="Coupon Analytics">
          <MetricGrid rows={[
            ["Discount Given", inr(coupons.discountGiven)],
            ["Coupon Revenue", inr(coupons.couponRevenue)],
            ["Orders With Coupon", coupons.conversionImpact?.ordersWithCoupon],
            ["Total Orders", coupons.conversionImpact?.totalOrders],
          ]} />
          <MiniList title="Most used coupons" rows={(coupons.mostUsedCoupons ?? []).map((c: any) => `${c.code}: ${c.uses} uses · ${inr(c.discount)} discount · ${inr(c.revenue)} revenue`)} />
          <MiniList title="Expiring coupons" rows={(coupons.expiringCoupons ?? []).map((c: any) => `${c.code}: ${c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-IN") : "No expiry"}`)} />
        </AnalyticsPanel>

        <AnalyticsPanel title="Review Analytics">
          <MetricGrid rows={[
            ["Average Rating", reviews.averageRating],
            ["Pending", reviews.pendingReviews],
            ["Approved", reviews.approvedReviews],
            ["Rejected", reviews.rejectedReviews],
            ["Featured", reviews.featuredReviews],
            ["Review Requests Pending", reviews.reviewRequestPendingCount],
          ]} />
          <MiniList title="Most reviewed products" rows={(reviews.mostReviewedProducts ?? []).map((p: any) => `${p.name || p.productId}: ${p.reviews} reviews · ${p.averageRating}/5`)} />
        </AnalyticsPanel>

        <AnalyticsPanel title="Email Analytics">
          <MetricGrid rows={[
            ["Sent", email.sent],
            ["Failed", email.failed],
            ["Queued", email.queued],
            ["Delivered", email.delivered],
            ["Opened", email.opened],
            ["Clicked", email.clicked],
            ["Bounced", email.bounced],
            ["Complaints", email.complaints],
          ]} />
          <MiniList title="Template performance" rows={(email.templatePerformance ?? []).map((t: any) => `${t.template}: ${t.sent} sent · ${t.failed} failed · ${t.opened} opened · ${t.clicked} clicked`)} />
          <MiniList title="Campaign performance" rows={(email.campaignPerformance ?? []).map((c: any) => `${c.name}: ${c.status} · ${c.recipientCount} recipients`)} />
        </AnalyticsPanel>
      </div>
    </div>
  );
}

function AnalyticsPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-sm border border-border p-4">
      <h3 className="font-display text-xl">{title}</h3>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function MetricGrid({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-sm bg-secondary/30 p-3">
          <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <p className="mt-1 font-display text-xl">{value ?? 0}</p>
        </div>
      ))}
    </div>
  );
}

function MiniList({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <div className="mt-2 space-y-1 text-sm">
        {rows.length === 0 ? <p className="text-muted-foreground">No data for this range.</p> : rows.map((row, i) => <p key={`${row}-${i}`}>{row}</p>)}
      </div>
    </div>
  );
}

function AnalyticsTable({ headers, rows }: { headers: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          <tr>{headers.map((header) => <th key={header} className="border-b border-border py-2 pr-3">{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td className="py-3 text-muted-foreground" colSpan={headers.length}>No data for this range.</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i} className="border-b border-border/60">
              {row.map((cell, j) => <td key={j} className="py-2 pr-3">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function analyticsExportRows(type: string, data: any) {
  if (type === "revenue") {
    return [
      ["Date", "Revenue", "Orders", "AOV", "Refunds", "Cancelled", "Discount", "Shipping", "Packaging"],
      ...(data.revenue?.series ?? []).map((row: any) => [row.date, row.revenue, row.orders, row.averageOrderValue, row.refunds, row.cancelledOrders, row.couponDiscountTotal, row.shippingRevenue, row.packagingRevenue]),
    ];
  }
  if (type === "products") {
    return [
      ["Product", "Revenue", "Sold", "Views", "Wishlist", "Rating", "Stock", "Return Rate"],
      ...(data.products?.products ?? []).map((p: any) => [p.name, p.revenue, p.soldQuantity, p.views, p.wishlistCount, p.averageRating, p.stock, p.returnRate]),
    ];
  }
  if (type === "customers") {
    return [
      ["Customer", "Email", "Orders", "Revenue"],
      ...(data.customers?.topCustomersByRevenue ?? []).map((c: any) => [c.name, c.email, c.orders, c.revenue]),
    ];
  }
  if (type === "inventory") {
    return [
      ["Metric", "Value"],
      ["Available Stock Value", data.inventory?.availableStockValue],
      ["Reserved Stock Value", data.inventory?.reservedStockValue],
      ["Sold Stock Count", data.inventory?.soldStockCount],
      ["Damaged Stock Count", data.inventory?.damagedStockCount],
      ["Returned Stock Count", data.inventory?.returnedStockCount],
      ["Low Stock Warnings", data.inventory?.lowStockWarnings],
    ];
  }
  if (type === "payments") return objectRows(data.payments);
  if (type === "shipping") return objectRows(data.shipping);
  if (type === "coupons") return objectRows(data.coupons);
  if (type === "reviews") return objectRows(data.reviews);
  if (type === "emails") return objectRows(data.email);
  if (type === "full") return [["Section", "JSON"], ...Object.entries(data).map(([key, value]) => [key, JSON.stringify(value)])];
  return objectRows(data.summary);
}

function objectRows(value: Record<string, unknown> = {}) {
  return [["Metric", "Value"], ...Object.entries(value).map(([key, val]) => [key, typeof val === "object" ? JSON.stringify(val) : String(val ?? "")])];
}

function OrdersAdmin() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const { settings } = useBusinessSettings();
  const confirmManualOrderFn = useServerFn(confirmManualOrder);
  const rejectManualPaymentFn = useServerFn(rejectManualPayment);
  const resolveRefundFn = useServerFn(resolveRefund);
  const updateOrderOperationsFn = useServerFn(updateOrderOperations);
  const bulkUpdateOrdersFn = useServerFn(bulkUpdateOrders);
  const createShipmentFn = useServerFn(createShipment);
  const cancelShipmentFn = useServerFn(cancelShipment);
  const fetchTrackingFn = useServerFn(fetchTracking);
  const syncShipmentStatusFn = useServerFn(syncShipmentStatus);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [paymentDraft, setPaymentDraft] = useState<Partial<PaymentMethod> | null>(null);
  const pageSize = 50;
  const { data: paymentMethods = [] } = useAdminPaymentMethods();
  const { data: refunds = [] } = useRefundRequests();
  const { data: paymentAnalytics = {} } = usePaymentAnalytics();
  const savePaymentMethod = useSavePaymentMethod();
  const { data: paymentLedger = [] } = useQuery({
    queryKey: ["admin-payment-ledger"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_ledger" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(250);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders", page],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_events(*), shipment_events(*)")
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (error) throw error;
      return data;
    },
  });

  const filteredOrders = orders.filter((o: any) => {
    const haystack = [
      o.order_number,
      o.id,
      o.customer_name,
      o.email,
      o.phone,
      o.payment_utr,
      o.payment_status,
      o.status,
      o.operational_status,
      ...(Array.isArray(o.items) ? o.items.map((item: any) => item.name) : []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
    const matchesPayment = paymentFilter === "all" || o.payment_status === paymentFilter;
    const matchesStatus =
      statusFilter === "all" || o.operational_status === statusFilter || o.status === statusFilter;
    return matchesSearch && matchesPayment && matchesStatus;
  });

  const today = new Date().toDateString();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const summary = {
    today: orders.filter((o: any) => new Date(o.created_at).toDateString() === today).length,
    pendingPayments: orders.filter((o: any) =>
      ["awaiting_payment", "under_review", "pending"].includes(o.payment_status),
    ).length,
    pendingPacking: orders.filter((o: any) =>
      ["payment_approved", "processing"].includes(o.operational_status),
    ).length,
    pendingShipping: orders.filter((o: any) =>
      ["packed", "ready_to_ship"].includes(o.operational_status),
    ).length,
    deliveredToday: orders.filter(
      (o: any) => o.delivery_date && new Date(o.delivery_date).toDateString() === today,
    ).length,
    cancelled: orders.filter((o: any) => o.status === "cancelled").length,
    refunds: orders.filter((o: any) => String(o.refund_status || "").startsWith("refund")).length,
    revenueToday: orders
      .filter((o: any) => new Date(o.created_at).toDateString() === today && isPaidOrder(o))
      .reduce((sum: number, o: any) => sum + Number(o.total || 0), 0),
    revenueMonth: orders
      .filter((o: any) => String(o.created_at).startsWith(thisMonth) && isPaidOrder(o))
      .reduce((sum: number, o: any) => sum + Number(o.total || 0), 0),
  };

  const confirmManual = useMutation({
    mutationFn: async (orderId: string) => {
      if (!session?.access_token) throw new Error("Please sign in again.");
      await confirmManualOrderFn({
        data: { orderId, accessToken: session.access_token },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["admin-payment-ledger"] });
      qc.invalidateQueries({ queryKey: ["payment-analytics-v2"] });
      toast.success("Order confirmed and stock updated.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not confirm order."),
  });

  const rejectPayment = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason?: string }) => {
      if (!session?.access_token) throw new Error("Please sign in again.");
      await rejectManualPaymentFn({
        data: { orderId, reason, accessToken: session.access_token },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-payment-ledger"] });
      qc.invalidateQueries({ queryKey: ["payment-analytics-v2"] });
      toast.success("Payment rejected.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not reject payment."),
  });

  const resolveRefundMutation = useMutation({
    mutationFn: async ({
      refundId,
      orderId,
      status,
      amount,
      reference,
      notes,
    }: {
      refundId: string;
      orderId: string;
      status: "approved" | "rejected" | "completed";
      amount?: number;
      reference?: string;
      notes?: string;
    }) => {
      if (!session?.access_token) throw new Error("Please sign in again.");
      await resolveRefundFn({
        data: {
          refundId,
          orderId,
          status,
          amount,
          reference,
          notes,
          accessToken: session.access_token,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["refund-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-payment-ledger"] });
      qc.invalidateQueries({ queryKey: ["payment-analytics-v2"] });
      toast.success("Refund updated.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update refund."),
  });

  const updateOps = useMutation({
    mutationFn: async (payload: Omit<Parameters<typeof updateOrderOperationsFn>[0]["data"], "accessToken">) => {
      if (!session?.access_token) throw new Error("Please sign in again.");
      await updateOrderOperationsFn({
        data: { ...payload, accessToken: session.access_token },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("Order updated.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update order."),
  });

  const bulkOps = useMutation({
    mutationFn: async ({
      operational_status,
      shipping_status,
      event_label,
    }: {
      operational_status: string;
      shipping_status?: string;
      event_label?: string;
    }) => {
      if (!session?.access_token) throw new Error("Please sign in again.");
      await bulkUpdateOrdersFn({
        data: {
          orderIds: selected,
          operational_status,
          shipping_status,
          event_label,
          accessToken: session.access_token,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      setSelected([]);
      toast.success("Bulk update complete.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Bulk update failed."),
  });

  const shipmentAction = useMutation({
    mutationFn: async ({
      action,
      orderId,
      provider,
    }: {
      action: "create" | "cancel" | "fetch" | "sync";
      orderId: string;
      provider?: string;
    }) => {
      if (!session?.access_token) throw new Error("Please sign in again.");
      const data = { orderId, provider, accessToken: session.access_token };
      if (action === "create") return createShipmentFn({ data });
      if (action === "cancel") return cancelShipmentFn({ data });
      if (action === "fetch") return fetchTrackingFn({ data });
      return syncShipmentStatusFn({ data });
    },
    onSuccess: (result: any) => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success(result?.mode === "provider_stub" ? "Provider shipment stub created." : "Shipment action complete.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Shipment action failed."),
  });

  if (isLoading) return <p className="mt-8 text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Orders Today", summary.today],
          ["Pending Payments", summary.pendingPayments],
          ["Pending Packing", summary.pendingPacking],
          ["Pending Shipping", summary.pendingShipping],
          ["Delivered Today", summary.deliveredToday],
          ["Cancelled", summary.cancelled],
          ["Refunds", summary.refunds],
          ["Revenue Today", inr(summary.revenueToday)],
          ["Revenue This Month", inr(summary.revenueMonth)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-sm border border-border p-4">
            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 font-display text-2xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-sm border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Payment Settings</p>
              <h3 className="mt-1 font-display text-2xl">Methods</h3>
            </div>
            {paymentDraft && (
              <button
                type="button"
                onClick={() =>
                  savePaymentMethod.mutate(paymentDraft, {
                    onSuccess: () => {
                      setPaymentDraft(null);
                      toast.success("Payment method saved.");
                    },
                    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save method."),
                  })
                }
                className="rounded-full bg-primary px-4 py-2 text-xs uppercase tracking-[0.18em] text-primary-foreground"
              >
                Save
              </button>
            )}
          </div>
          <div className="mt-4 space-y-3">
            {paymentMethods.map((pm) => (
              <div key={pm.method_key} className="rounded-sm border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{pm.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {pm.method_key} · {pm.enabled ? "enabled" : "disabled"} · fee {inr(Number(pm.extra_fee || 0))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPaymentDraft(pm)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
          {paymentDraft && (
            <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
              <Field label="Display name">
                <input className={inputCls} value={paymentDraft.display_name ?? ""} onChange={(e) => setPaymentDraft({ ...paymentDraft, display_name: e.target.value })} />
              </Field>
              <Field label="Enabled">
                <select className={inputCls} value={paymentDraft.enabled ? "true" : "false"} onChange={(e) => setPaymentDraft({ ...paymentDraft, enabled: e.target.value === "true" })}>
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </Field>
              <Field label="Min amount">
                <input type="number" className={inputCls} value={paymentDraft.min_order_amount ?? 0} onChange={(e) => setPaymentDraft({ ...paymentDraft, min_order_amount: Number(e.target.value) })} />
              </Field>
              <Field label="Max amount">
                <input type="number" className={inputCls} value={paymentDraft.max_order_amount ?? ""} onChange={(e) => setPaymentDraft({ ...paymentDraft, max_order_amount: e.target.value ? Number(e.target.value) : null })} />
              </Field>
              <Field label="Extra fee">
                <input type="number" className={inputCls} value={paymentDraft.extra_fee ?? 0} onChange={(e) => setPaymentDraft({ ...paymentDraft, extra_fee: Number(e.target.value) })} />
              </Field>
              <Field label="Sort order">
                <input type="number" className={inputCls} value={paymentDraft.sort_order ?? 0} onChange={(e) => setPaymentDraft({ ...paymentDraft, sort_order: Number(e.target.value) })} />
              </Field>
              <Field label="Recommended">
                <select className={inputCls} value={paymentDraft.recommended ? "true" : "false"} onChange={(e) => setPaymentDraft({ ...paymentDraft, recommended: e.target.value === "true" })}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </Field>
              <Field label="Verification time">
                <input className={inputCls} value={paymentDraft.verification_time ?? ""} onChange={(e) => setPaymentDraft({ ...paymentDraft, verification_time: e.target.value })} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Instructions">
                  <textarea rows={3} className={inputCls} value={paymentDraft.instructions ?? ""} onChange={(e) => setPaymentDraft({ ...paymentDraft, instructions: e.target.value })} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Public details JSON">
                  <textarea
                    rows={3}
                    className={inputCls}
                    value={JSON.stringify(paymentDraft.public_details ?? {}, null, 2)}
                    onChange={(e) => {
                      try {
                        setPaymentDraft({ ...paymentDraft, public_details: JSON.parse(e.target.value || "{}") });
                      } catch {
                        setPaymentDraft({ ...paymentDraft });
                      }
                    }}
                  />
                </Field>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-sm border border-border p-4">
          <p className="eyebrow">Payment Analytics</p>
          <h3 className="mt-1 font-display text-2xl">Summary</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Fees Collected", inr(Number((paymentAnalytics as any).feesCollected || 0))],
              ["UPI Pending", (paymentAnalytics as any).pending?.upi ?? 0],
              ["Bank Pending", (paymentAnalytics as any).pending?.bankTransfer ?? 0],
              ["COD Pending", (paymentAnalytics as any).pending?.cod ?? 0],
              ["Razorpay Paid", (paymentAnalytics as any).razorpay?.paid ?? 0],
              ["Razorpay Failed", (paymentAnalytics as any).razorpay?.failed ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-sm border border-border p-3">
                <p className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                <p className="mt-1 font-display text-xl">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Refunds</p>
            <div className="mt-3 space-y-2">
              {refunds.slice(0, 6).map((refund: any) => (
                <div key={refund.id} className="rounded-sm border border-border p-3 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{refund.orders?.order_number || refund.order_id}</p>
                      <p className="text-muted-foreground">{statusLabel(refund.status)} · {inr(Number(refund.amount || 0))}</p>
                    </div>
                    {refund.status !== "completed" && refund.status !== "rejected" && (
                      <div className="flex gap-1">
                        <button onClick={() => resolveRefundMutation.mutate({ refundId: refund.id, orderId: refund.order_id, status: "approved", amount: Number(refund.amount || 0) })} className="rounded-full border border-border px-2 py-1">Approve</button>
                        <button onClick={() => {
                          const reference = prompt("Refund reference?") ?? "";
                          resolveRefundMutation.mutate({ refundId: refund.id, orderId: refund.order_id, status: "completed", amount: Number(refund.amount || 0), reference });
                        }} className="rounded-full border border-border px-2 py-1">Complete</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {refunds.length === 0 && <p className="text-xs text-muted-foreground">No refund requests yet.</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-sm border border-border p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-3 text-muted-foreground" size={15} />
            <input
              className={inputCls + " pl-9"}
              placeholder="Search order, customer, phone, UTR, product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            className={inputCls}
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="all">All payments</option>
            {["awaiting_payment", "under_review", "approved", "paid", "manual_confirmed", "rejected", "expired"].map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
          <select
            className={inputCls}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            {ORDER_STATUS_FLOW.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => exportOrdersCsv(filteredOrders)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.18em]"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>

        {selected.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <span className="text-xs text-muted-foreground">{selected.length} selected</span>
            <button
              type="button"
              onClick={() => bulkOps.mutate({ operational_status: "packed", shipping_status: "packed", event_label: "Packed" })}
              className="rounded-full border border-border px-3 py-1.5 text-xs"
            >
              Mark Packed
            </button>
            <button
              type="button"
              onClick={() => bulkOps.mutate({ operational_status: "shipped", shipping_status: "shipped", event_label: "Shipped" })}
              className="rounded-full border border-border px-3 py-1.5 text-xs"
            >
              Mark Shipped
            </button>
            <button
              type="button"
              onClick={() => bulkOps.mutate({ operational_status: "archived", event_label: "Archived" })}
              className="rounded-full border border-border px-3 py-1.5 text-xs"
            >
              Archive
            </button>
          </div>
        )}
      </div>

      {filteredOrders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matching orders.</p>
      ) : filteredOrders.map((o: any) => {
        const manualProofMethod = ["upi", "bank_transfer"].includes(o.payment_method);
        const canApproveManual =
          manualProofMethod &&
          o.payment_status === "under_review" &&
          o.status !== "confirmed";
        const canConfirmManual =
          (o.payment_method === "cod" && o.payment_status === "cod_pending") ||
          (o.payment_method !== "upi" &&
            o.payment_method !== "bank_transfer" &&
            o.payment_method !== "razorpay" &&
            !o.stock_deducted_at);
        const canReject =
          ["upi", "bank_transfer", "cod"].includes(o.payment_method) &&
          !["confirmed", "expired", "payment_rejected", "cancelled"].includes(o.status) &&
          !["approved", "paid", "manual_confirmed"].includes(o.payment_status);
        const orderLedger = paymentLedger.filter((entry: any) => entry.order_id === o.id);
        const events = [
          ...(o.order_events ?? []).map((event: any) => ({
            ...event,
            label: event.label,
            kind: "order",
          })),
          ...(o.shipment_events ?? []).map((event: any) => ({
            ...event,
            label: `${statusLabel(event.status)}${event.tracking_number ? ` · ${event.tracking_number}` : ""}`,
            kind: "shipment",
          })),
        ].sort(
          (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
        const isSelected = selected.includes(o.id);

        return (
        <div key={o.id} className="rounded-sm border border-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) =>
                  setSelected((current) =>
                    e.target.checked ? [...current, o.id] : current.filter((id) => id !== o.id),
                  )
                }
                className="mt-1"
                aria-label={`Select order ${o.order_number || o.id}`}
              />
              <div>
              <p className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                {o.order_number || `#${o.id.slice(0, 8)}`}
              </p>
              <p className="font-display text-lg">{o.customer_name}</p>
              <p className="text-sm text-muted-foreground">
                {o.phone} {o.email && `· ${o.email}`}
              </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-lg">{inr(o.total)}</p>
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                {o.payment_method} · {statusLabel(o.payment_status)} · {statusLabel(o.operational_status || o.status)}
              </p>
              {(canApproveManual || canConfirmManual || canReject) && (
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  {(canApproveManual || canConfirmManual) && (
                    <button
                      disabled={confirmManual.isPending}
                      onClick={() => confirmManual.mutate(o.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs"
                    >
                      {confirmManual.isPending && <Loader2 size={12} className="animate-spin" />}
                      {manualProofMethod ? "Approve payment" : "Confirm order"}
                    </button>
                  )}
                  {canReject && (
                    <button
                      disabled={rejectPayment.isPending}
                      onClick={() => {
                        const reason = prompt("Reason for rejecting this payment?") ?? "";
                        rejectPayment.mutate({ orderId: o.id, reason });
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-destructive"
                    >
                      Reject
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{o.address}</p>
          {Number(o.stock ?? 0) <= Number(o.low_stock_threshold ?? 5) && false}
          {manualProofMethod && (
            <div className="mt-3 rounded-sm border border-border bg-secondary/30 p-3 text-sm">
              {o.payment_method === "upi" && (
                <p>
                  <span className="text-muted-foreground">UPI ID:</span> {settings.upi_id}
                </p>
              )}
              <p>
                <span className="text-muted-foreground">Reference:</span>{" "}
                {o.payment_utr || "Not submitted"}
              </p>
              <p className="mt-1 text-muted-foreground">
                Submitted:{" "}
                {o.payment_submitted_at
                  ? new Date(o.payment_submitted_at).toLocaleString("en-IN")
                  : "Not submitted"}
              </p>
              {o.payment_expires_at && (
                <p className="mt-1 text-muted-foreground">
                  Expires: {new Date(o.payment_expires_at).toLocaleString("en-IN")}
                </p>
              )}
              {o.payment_verified_at && (
                <p className="mt-1 text-muted-foreground">
                  Verified: {new Date(o.payment_verified_at).toLocaleString("en-IN")}
                </p>
              )}
              {o.payment_screenshot_url && (
                <a
                  href={o.payment_screenshot_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block underline-offset-4 hover:underline"
                >
                  View payment screenshot
                </a>
              )}
              {o.payment_rejection_reason && (
                <p className="mt-1 text-destructive">
                  Rejection reason: {o.payment_rejection_reason}
                </p>
              )}
            </div>
          )}
          {orderLedger.length > 0 && (
            <div className="mt-3 rounded-sm border border-border bg-background p-3 text-xs">
              <p className="uppercase tracking-[0.18em] text-muted-foreground">Payment ledger</p>
              <div className="mt-2 space-y-1">
                {orderLedger.map((entry: any) => (
                  <p key={entry.id} className="flex flex-wrap justify-between gap-2">
                    <span>{statusLabel(entry.status)} · {entry.method} · {inr(Number(entry.amount || 0))}</span>
                    <span className="text-muted-foreground">
                      {entry.reference_id || entry.provider_payment_id || entry.provider_order_id || "no reference"} · {new Date(entry.created_at).toLocaleString("en-IN")}
                    </span>
                  </p>
                ))}
              </div>
            </div>
          )}
          <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
            {(o.items as any[]).map((it, i) => (
              <li key={i} className="flex justify-between">
                <span>
                  {it.name}
                  {it.variant_label && <span className="text-muted-foreground"> · {it.variant_label}</span>} × {it.qty}
                </span>
                <span>{inr(it.price * it.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-4 border-t border-border pt-4 lg:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Timeline</p>
              <div className="mt-3 space-y-2">
                {events.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No timeline events yet.</p>
                ) : events.map((event: any) => (
                  <div key={event.id} className="flex gap-3 text-xs">
                    <span className="w-16 shrink-0 text-muted-foreground">
                      {new Date(event.created_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span>
                      {event.label}
                      {event.kind === "shipment" && (
                        <span className="ml-2 text-muted-foreground">(shipment)</span>
                      )}
                      {!event.visible_to_customer && (
                        <span className="ml-2 text-muted-foreground">(internal)</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Shipping status">
                  <select
                    className={inputCls}
                    defaultValue={o.shipping_status || o.operational_status || "not_shipped"}
                    onChange={(e) => {
                      const flow = ORDER_STATUS_FLOW.find((s) => s.value === e.target.value);
                      updateOps.mutate({
                        orderId: o.id,
                        operational_status: e.target.value,
                        shipping_status: flow?.shipping || e.target.value,
                        event_label: flow?.label || statusLabel(e.target.value),
                        delivery_date: e.target.value === "delivered" ? new Date().toISOString().slice(0, 10) : undefined,
                        visible_to_customer: true,
                      });
                    }}
                  >
                    {ORDER_STATUS_FLOW.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Shipping provider">
                  <input
                    className={inputCls}
                    defaultValue={o.shipping_provider ?? "manual"}
                    onBlur={(e) =>
                      updateOps.mutate({
                        orderId: o.id,
                        shipping_provider: e.target.value,
                        event_label: "Shipping Provider Updated",
                        visible_to_customer: false,
                      })
                    }
                  />
                </Field>
                <Field label="Courier">
                  <input
                    className={inputCls}
                    defaultValue={o.courier_name ?? ""}
                    onBlur={(e) =>
                      updateOps.mutate({
                        orderId: o.id,
                        courier_name: e.target.value,
                        event_label: "Courier Updated",
                        visible_to_customer: true,
                      })
                    }
                  />
                </Field>
                <Field label="Tracking number">
                  <input
                    className={inputCls}
                    defaultValue={o.tracking_number ?? ""}
                    onBlur={(e) =>
                      updateOps.mutate({
                        orderId: o.id,
                        tracking_number: e.target.value,
                        event_label: "Tracking Updated",
                        visible_to_customer: true,
                      })
                    }
                  />
                </Field>
                <Field label="Tracking URL">
                  <input
                    className={inputCls}
                    defaultValue={o.tracking_url ?? ""}
                    onBlur={(e) =>
                      updateOps.mutate({
                        orderId: o.id,
                        tracking_url: e.target.value,
                        event_label: "Tracking Link Updated",
                        visible_to_customer: true,
                      })
                    }
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="ETA">
                  <input
                    type="date"
                    className={inputCls}
                    defaultValue={o.estimated_delivery_date ?? ""}
                    onBlur={(e) =>
                      updateOps.mutate({
                        orderId: o.id,
                        estimated_delivery_date: e.target.value,
                        event_label: "Estimated Delivery Updated",
                        visible_to_customer: true,
                      })
                    }
                  />
                </Field>
                <Field label="Dispatch date">
                  <input
                    type="date"
                    className={inputCls}
                    defaultValue={o.dispatch_date ?? ""}
                    onBlur={(e) =>
                      updateOps.mutate({
                        orderId: o.id,
                        dispatch_date: e.target.value,
                        event_label: "Dispatch Date Updated",
                        visible_to_customer: true,
                      })
                    }
                  />
                </Field>
                <Field label="Delivery date">
                  <input
                    type="date"
                    className={inputCls}
                    defaultValue={o.delivery_date ?? ""}
                    onBlur={(e) =>
                      updateOps.mutate({
                        orderId: o.id,
                        delivery_date: e.target.value,
                        event_label: "Delivery Date Updated",
                        visible_to_customer: true,
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Shipping notes">
                <textarea
                  rows={2}
                  className={inputCls}
                  defaultValue={o.shipping_notes ?? ""}
                  onBlur={(e) =>
                    updateOps.mutate({
                      orderId: o.id,
                      shipping_notes: e.target.value,
                      event_label: "Shipping Note Updated",
                      visible_to_customer: true,
                    })
                  }
                />
              </Field>
              <Field label="Internal notes">
                <textarea
                  rows={2}
                  className={inputCls}
                  defaultValue={o.internal_notes ?? ""}
                  onBlur={(e) =>
                    updateOps.mutate({
                      orderId: o.id,
                      internal_notes: e.target.value,
                      event_label: "Internal Note Updated",
                      visible_to_customer: false,
                    })
                  }
                />
              </Field>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {ORDER_STATUS_FLOW.filter((s) => s.quick).map((s) => (
              <button
                key={s.value}
                type="button"
                disabled={updateOps.isPending}
                onClick={() =>
                  updateOps.mutate({
                    orderId: o.id,
                    operational_status: s.value,
                    shipping_status: s.shipping,
                    delivery_date: s.value === "delivered" ? new Date().toISOString().slice(0, 10) : undefined,
                    dispatch_date: ["picked_up", "in_transit", "shipped"].includes(s.value) ? new Date().toISOString().slice(0, 10) : undefined,
                    event_label: s.label,
                    visible_to_customer: true,
                  })
                }
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs"
              >
                {s.icon === "pack" ? <PackageCheck size={12} /> : s.icon === "ship" ? <Truck size={12} /> : null}
                {s.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                updateOps.mutate({
                  orderId: o.id,
                  operational_status: "cancelled",
                  event_label: "Order Cancelled",
                  visible_to_customer: true,
                })
              }
              className="rounded-full border border-border px-3 py-1.5 text-xs text-destructive"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const reason = prompt("Refund reason?") ?? "";
                updateOps.mutate({
                  orderId: o.id,
                  operational_status: "refund_requested",
                  refund_status: "refund_requested",
                  refund_reason: reason,
                  event_label: "Refund Requested",
                  visible_to_customer: true,
                });
              }}
              className="rounded-full border border-border px-3 py-1.5 text-xs"
            >
              Refund
            </button>
            <button
              type="button"
              onClick={() => printInvoice(o, settings)}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs"
            >
              <FileText size={12} /> Print Invoice
            </button>
            <button
              type="button"
              onClick={() => printPackingSlip(o, settings)}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs"
            >
              <FileText size={12} /> Packing Slip
            </button>
            <button
              type="button"
              onClick={() => printShippingLabel(o, settings)}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs"
            >
              <Truck size={12} /> Shipping Label
            </button>
            <button
              type="button"
              disabled={shipmentAction.isPending}
              onClick={() =>
                shipmentAction.mutate({
                  action: "create",
                  orderId: o.id,
                  provider: o.shipping_provider || settings.default_shipping_provider || "manual",
                })
              }
              className="rounded-full border border-border px-3 py-1.5 text-xs"
            >
              Create Shipment
            </button>
            <button
              type="button"
              disabled={shipmentAction.isPending}
              onClick={() => shipmentAction.mutate({ action: "fetch", orderId: o.id })}
              className="rounded-full border border-border px-3 py-1.5 text-xs"
            >
              Fetch Tracking
            </button>
            <button
              type="button"
              disabled={shipmentAction.isPending}
              onClick={() => shipmentAction.mutate({ action: "sync", orderId: o.id })}
              className="rounded-full border border-border px-3 py-1.5 text-xs"
            >
              Sync Shipment
            </button>
            <button
              type="button"
              disabled={shipmentAction.isPending}
              onClick={() => shipmentAction.mutate({ action: "cancel", orderId: o.id })}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-destructive"
            >
              Cancel Shipment
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {new Date(o.created_at).toLocaleString("en-IN")}
          </p>
        </div>
        );
      })}
      <div className="flex justify-between">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.18em] disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={orders.length < pageSize}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.18em] disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

const ORDER_STATUS_FLOW = [
  { value: "new", label: "New", shipping: "not_shipped" },
  { value: "not_shipped", label: "Not Shipped", shipping: "not_shipped" },
  { value: "processing", label: "Processing", shipping: "not_shipped", quick: true },
  { value: "payment_approved", label: "Payment Approved", shipping: "not_shipped" },
  { value: "packing", label: "Packing", shipping: "packing", quick: true, icon: "pack" },
  { value: "ready_to_ship", label: "Ready To Ship", shipping: "ready_to_ship", quick: true },
  { value: "pickup_scheduled", label: "Pickup Scheduled", shipping: "pickup_scheduled", quick: true },
  { value: "picked_up", label: "Picked Up", shipping: "picked_up", quick: true },
  { value: "in_transit", label: "In Transit", shipping: "in_transit", quick: true, icon: "ship" },
  { value: "shipped", label: "Shipped", shipping: "in_transit" },
  { value: "out_for_delivery", label: "Out for Delivery", shipping: "out_for_delivery", quick: true },
  { value: "delivered", label: "Delivered", shipping: "delivered", quick: true },
  { value: "delivery_failed", label: "Delivery Failed", shipping: "delivery_failed", quick: true },
  { value: "returned_to_origin", label: "Returned To Origin", shipping: "returned_to_origin", quick: true },
  { value: "lost", label: "Lost", shipping: "lost" },
  { value: "completed", label: "Completed", quick: true },
  { value: "cancelled", label: "Cancelled", shipping: "cancelled" },
  { value: "returned", label: "Returned" },
  { value: "refund_requested", label: "Refund Requested" },
  { value: "refund_approved", label: "Refund Approved" },
  { value: "refund_completed", label: "Refund Completed" },
  { value: "expired", label: "Expired" },
];

function statusLabel(value?: string | null) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isPaidOrder(order: any) {
  return ["approved", "paid", "manual_confirmed"].includes(order.payment_status);
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportOrdersCsv(orders: any[]) {
  const rows = [
    ["Order Number", "Customer", "Email", "Phone", "Payment", "Status", "Total", "Created"],
    ...orders.map((o) => [
      o.order_number || o.id,
      o.customer_name,
      o.email || "",
      o.phone,
      o.payment_status,
      o.operational_status || o.status,
      o.total,
      o.created_at,
    ]),
  ];
  downloadCsv("orders.csv", rows);
}

function exportInventoryCsv(products: Product[]) {
  const rows = [
    [
      "Product",
      "SKU/Slug",
      "Category",
      "Status",
      "Available Stock",
      "Reserved Stock",
      "Sold Stock",
      "Damaged Stock",
      "Returned Stock",
      "Low Stock Threshold",
      "Lifetime Sales",
    ],
    ...products.map((p) => [
      p.name,
      p.slug,
      p.category,
      p.product_status || (p.active ? "active" : "archived"),
      p.stock,
      p.reserved_stock ?? 0,
      p.sold_stock ?? 0,
      p.damaged_stock ?? 0,
      p.returned_stock ?? 0,
      p.low_stock_threshold ?? 5,
      p.lifetime_sales ?? 0,
    ]),
  ];
  downloadCsv("inventory.csv", rows);
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function CustomersAdmin() {
  const db = supabase as any;
  const { data, isLoading } = useQuery({
    queryKey: ["admin-customers-overview"],
    queryFn: async () => {
      const [profiles, orders, wishlists, reviews, subscribers, loyalty] = await Promise.all([
        db.from("customer_profiles").select("*").order("created_at", { ascending: false }),
        db.from("orders").select("user_id,email,customer_name,total,status,payment_status,created_at"),
        db.from("wishlist_items").select("id, product_id, wishlists(user_id), products(name)"),
        db.from("reviews").select("id,status,approved,user_id,product_id,rating,products(name)"),
        db.from("newsletter_subscribers").select("*").order("created_at", { ascending: false }),
        db.from("loyalty_points").select("*"),
      ]);
      for (const result of [profiles, orders, wishlists, reviews, subscribers, loyalty]) {
        if (result.error) throw result.error;
      }
      return {
        profiles: profiles.data ?? [],
        orders: orders.data ?? [],
        wishlists: wishlists.data ?? [],
        reviews: reviews.data ?? [],
        subscribers: subscribers.data ?? [],
        loyalty: loyalty.data ?? [],
      };
    },
  });

  if (isLoading) return <p className="mt-8 text-sm text-muted-foreground">Loading...</p>;

  const profiles = data?.profiles ?? [];
  const orders = data?.orders ?? [];
  const subscribers = data?.subscribers ?? [];
  const loyalty = data?.loyalty ?? [];
  const byEmail = new Map<string, { email: string; name: string; orders: number; spend: number }>();
  orders.forEach((order: any) => {
    const email = String(order.email || "").toLowerCase();
    if (!email) return;
    const current = byEmail.get(email) ?? { email, name: order.customer_name || "", orders: 0, spend: 0 };
    current.orders += 1;
    if (["approved", "paid", "manual_confirmed"].includes(order.payment_status)) {
      current.spend += Number(order.total || 0);
    }
    byEmail.set(email, current);
  });
  const topCustomers = [...byEmail.values()].sort((a, b) => b.spend - a.spend).slice(0, 10);
  const pendingReviews = (data?.reviews ?? []).filter((review: any) => !review.approved || review.status === "pending").length;

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Profiles", profiles.length],
          ["Newsletter", subscribers.filter((s: any) => s.subscribed).length],
          ["Wishlist Items", data?.wishlists?.length ?? 0],
          ["Pending Reviews", pendingReviews],
          ["Loyalty Accounts", loyalty.length],
          ["Known Customers", byEmail.size],
        ].map(([label, value]) => (
          <div key={label} className="rounded-sm border border-border p-4">
            <p className="inline-flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
              <Users size={13} /> {label}
            </p>
            <p className="mt-1 font-display text-2xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-sm border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl">Top customers</h2>
          <button
            type="button"
            onClick={() =>
              downloadCsv("customers.csv", [
                ["Email", "Name", "Orders", "Spend"],
                ...topCustomers.map((customer) => [customer.email, customer.name, customer.orders, customer.spend]),
              ])
            }
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.18em]"
          >
            <Download size={13} /> Export
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <tr><th className="py-2">Customer</th><th>Orders</th><th>Spend</th></tr>
            </thead>
            <tbody>
              {topCustomers.map((customer) => (
                <tr key={customer.email} className="border-t border-border">
                  <td className="py-2">{customer.name || customer.email}<br /><span className="text-xs text-muted-foreground">{customer.email}</span></td>
                  <td>{customer.orders}</td>
                  <td>{inr(customer.spend)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {topCustomers.length === 0 && <p className="py-6 text-sm text-muted-foreground">No customer orders yet.</p>}
        </div>
      </div>
    </div>
  );
}

type CouponDraft = {
  id?: string;
  code: string;
  description: string;
  discount_type: string;
  discount_value: number;
  minimum_purchase: number;
  maximum_discount: number | "";
  expires_at: string;
  usage_limit: number | "";
  per_user_limit: number;
  active: boolean;
  auto_apply: boolean;
};

const emptyCouponDraft = (): CouponDraft => ({
  code: "",
  description: "",
  discount_type: "percentage",
  discount_value: 10,
  minimum_purchase: 0,
  maximum_discount: "",
  expires_at: "",
  usage_limit: "",
  per_user_limit: 1,
  active: true,
  auto_apply: false,
});

function CouponsAdmin() {
  const db = supabase as any;
  const qc = useQueryClient();
  const [draft, setDraft] = useState<CouponDraft | null>(null);
  const [giftDraft, setGiftDraft] = useState({ code: "", balance: 0, issued_to_email: "", expires_at: "" });

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => {
      const { data, error } = await db.from("coupons").select("*, coupon_redemptions(*)").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: giftCards = [] } = useQuery({
    queryKey: ["admin-gift-cards"],
    queryFn: async () => {
      const { data, error } = await db.from("gift_cards").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveCoupon = useMutation({
    mutationFn: async (next: CouponDraft) => {
      const payload = {
        code: next.code.trim().toUpperCase(),
        description: next.description.trim(),
        discount_type: next.discount_type,
        discount_value: Number(next.discount_value || 0),
        minimum_purchase: Number(next.minimum_purchase || 0),
        maximum_discount: next.maximum_discount === "" ? null : Number(next.maximum_discount),
        expires_at: next.expires_at ? new Date(next.expires_at).toISOString() : null,
        usage_limit: next.usage_limit === "" ? null : Number(next.usage_limit),
        per_user_limit: Math.max(1, Number(next.per_user_limit || 1)),
        active: next.active,
        auto_apply: next.auto_apply,
      };
      if (!payload.code) throw new Error("Coupon code is required.");
      const query = next.id ? db.from("coupons").update(payload).eq("id", next.id) : db.from("coupons").insert(payload);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      setDraft(null);
      toast.success("Coupon saved.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save coupon."),
  });

  const toggleCoupon = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await db.from("coupons").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast.success("Coupon updated.");
    },
  });

  const createGiftCard = useMutation({
    mutationFn: async () => {
      const code = giftDraft.code.trim().toUpperCase() || `GIFT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const balance = Math.max(0, Math.round(Number(giftDraft.balance || 0)));
      if (!balance) throw new Error("Gift card balance is required.");
      const { error } = await db.from("gift_cards").insert({
        code,
        initial_balance: balance,
        balance,
        issued_to_email: giftDraft.issued_to_email.trim().toLowerCase() || null,
        expires_at: giftDraft.expires_at ? new Date(giftDraft.expires_at).toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-gift-cards"] });
      setGiftDraft({ code: "", balance: 0, issued_to_email: "", expires_at: "" });
      toast.success("Gift card created.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create gift card."),
  });

  if (isLoading) return <p className="mt-8 text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="mt-6 space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setDraft(emptyCouponDraft())}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground"
        >
          <Ticket size={14} /> Add coupon
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {coupons.map((coupon: any) => (
          <div key={coupon.id} className="rounded-sm border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-xl">{coupon.code}</p>
                <p className="mt-1 text-sm text-muted-foreground">{coupon.description || "No description"}</p>
              </div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{coupon.active ? "Active" : "Inactive"}</p>
            </div>
            <p className="mt-3 text-sm">
              {coupon.discount_type} · {coupon.discount_value} · Min {inr(Number(coupon.minimum_purchase || 0))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Used {coupon.coupon_redemptions?.length ?? 0}{coupon.usage_limit ? ` / ${coupon.usage_limit}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDraft({
                  id: coupon.id,
                  code: coupon.code,
                  description: coupon.description || "",
                  discount_type: coupon.discount_type,
                  discount_value: Number(coupon.discount_value || 0),
                  minimum_purchase: Number(coupon.minimum_purchase || 0),
                  maximum_discount: coupon.maximum_discount ?? "",
                  expires_at: coupon.expires_at ? String(coupon.expires_at).slice(0, 10) : "",
                  usage_limit: coupon.usage_limit ?? "",
                  per_user_limit: coupon.per_user_limit ?? 1,
                  active: coupon.active,
                  auto_apply: coupon.auto_apply,
                })}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs"
              >
                <Pencil size={12} /> Edit
              </button>
              <button
                type="button"
                onClick={() => toggleCoupon.mutate({ id: coupon.id, active: !coupon.active })}
                className="rounded-full border border-border px-3 py-1.5 text-xs"
              >
                {coupon.active ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-sm border border-border p-5">
        <h2 className="inline-flex items-center gap-2 font-display text-2xl"><Gift size={18} /> Gift cards</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <input className={inputCls} placeholder="Code (optional)" value={giftDraft.code} onChange={(e) => setGiftDraft({ ...giftDraft, code: e.target.value })} />
          <input className={inputCls} type="number" placeholder="Balance" value={giftDraft.balance} onChange={(e) => setGiftDraft({ ...giftDraft, balance: Number(e.target.value) })} />
          <input className={inputCls} type="email" placeholder="Recipient email" value={giftDraft.issued_to_email} onChange={(e) => setGiftDraft({ ...giftDraft, issued_to_email: e.target.value })} />
          <input className={inputCls} type="date" value={giftDraft.expires_at} onChange={(e) => setGiftDraft({ ...giftDraft, expires_at: e.target.value })} />
        </div>
        <button
          type="button"
          onClick={() => createGiftCard.mutate()}
          className="mt-3 rounded-full bg-primary px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground"
        >
          Generate gift card
        </button>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {giftCards.map((card: any) => (
            <div key={card.id} className="rounded-sm border border-border p-3 text-sm">
              <p className="font-medium">{card.code}</p>
              <p className="text-muted-foreground">{inr(Number(card.balance || 0))} remaining</p>
              {card.issued_to_email && <p className="text-xs text-muted-foreground">{card.issued_to_email}</p>}
            </div>
          ))}
        </div>
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4">
          <div className="my-8 w-full max-w-2xl rounded-sm border border-border bg-background p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">{draft.id ? "Edit coupon" : "New coupon"}</h2>
              <button onClick={() => setDraft(null)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Code"><input className={inputCls} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></Field>
              <Field label="Type">
                <select className={inputCls} value={draft.discount_type} onChange={(e) => setDraft({ ...draft, discount_type: e.target.value })}>
                  <option value="percentage">Percentage</option>
                  <option value="flat">Flat amount</option>
                  <option value="free_shipping">Free shipping</option>
                </select>
              </Field>
              <Field label="Discount value"><input type="number" className={inputCls} value={draft.discount_value} onChange={(e) => setDraft({ ...draft, discount_value: Number(e.target.value) })} /></Field>
              <Field label="Minimum purchase"><input type="number" className={inputCls} value={draft.minimum_purchase} onChange={(e) => setDraft({ ...draft, minimum_purchase: Number(e.target.value) })} /></Field>
              <Field label="Maximum discount"><input type="number" className={inputCls} value={draft.maximum_discount} onChange={(e) => setDraft({ ...draft, maximum_discount: e.target.value === "" ? "" : Number(e.target.value) })} /></Field>
              <Field label="Expiry"><input type="date" className={inputCls} value={draft.expires_at} onChange={(e) => setDraft({ ...draft, expires_at: e.target.value })} /></Field>
              <Field label="Usage limit"><input type="number" className={inputCls} value={draft.usage_limit} onChange={(e) => setDraft({ ...draft, usage_limit: e.target.value === "" ? "" : Number(e.target.value) })} /></Field>
              <Field label="Per user limit"><input type="number" className={inputCls} value={draft.per_user_limit} onChange={(e) => setDraft({ ...draft, per_user_limit: Number(e.target.value) })} /></Field>
              <Field label="Description"><textarea rows={3} className={inputCls} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
              <div className="space-y-3 pt-6">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Active</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.auto_apply} onChange={(e) => setDraft({ ...draft, auto_apply: e.target.checked })} /> Auto apply</label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setDraft(null)} className="rounded-full border border-border px-5 py-2.5 text-xs uppercase tracking-[0.2em]">Cancel</button>
              <button onClick={() => saveCoupon.mutate(draft)} className="rounded-full bg-primary px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground">Save coupon</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function printInvoice(order: any, settings: BusinessSettings) {
  printOrderDocument(order, settings, "Invoice", true);
}

function printPackingSlip(order: any, settings: BusinessSettings) {
  printOrderDocument(order, settings, "Packing Slip", false);
}

function printShippingLabel(order: any, settings: BusinessSettings) {
  const win = window.open("", "_blank", "width=700,height=700");
  if (!win) return;
  const labelId = order.tracking_number || order.order_number || order.id;
  win.document.write(`<!doctype html><html><head><title>Shipping Label ${escapeHtml(labelId)}</title>
    <style>body{font-family:Arial,sans-serif;padding:28px;color:#111}.label{border:2px solid #111;padding:24px;max-width:560px}.muted{color:#555;font-size:12px}.row{display:flex;justify-content:space-between;gap:16px;border-top:1px solid #ddd;padding-top:12px;margin-top:12px}.code{border:2px solid #111;padding:16px;text-align:center;font-family:monospace;font-size:18px;letter-spacing:2px}</style>
    </head><body><div class="label">
      ${settings.logo_url ? `<img src="${escapeHtml(settings.logo_url)}" style="max-height:70px;max-width:200px"/>` : `<h2>${escapeHtml(settings.business_name)}</h2>`}
      <p class="muted">SHIP FROM<br/>${escapeHtml(settings.pickup_address || settings.address || settings.business_name)}</p>
      <h1>SHIP TO</h1>
      <p><strong>${escapeHtml(order.customer_name || "")}</strong><br/>${escapeHtml(order.phone || "")}<br/>${escapeHtml(order.address || "")}</p>
      <div class="row"><div><strong>Courier</strong><br/>${escapeHtml(order.courier_name || order.shipping_provider || "Manual")}</div><div><strong>Mode</strong><br/>${escapeHtml(order.shipping_mode || "standard")}</div></div>
      <div class="row"><div><strong>Order</strong><br/>${escapeHtml(order.order_number || order.id)}</div><div><strong>ETA</strong><br/>${escapeHtml(order.estimated_delivery_date || "TBD")}</div></div>
      <p class="code">${escapeHtml(labelId)}</p>
      <p class="muted">Manual label. Verify courier requirements before handoff.</p>
    </div></body></html>`);
  win.document.close();
  win.print();
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function printOrderDocument(order: any, settings: BusinessSettings, title: string, showPrices: boolean) {
  const rows = (order.items as any[])
    .map(
      (item) => `<tr><td>${escapeHtml(item.name)}${item.variant_label ? ` (${escapeHtml(item.variant_label)})` : ""}</td><td>${escapeHtml(item.qty)}</td>${
        showPrices ? `<td>${inr(item.price)}</td><td>${inr(item.price * item.qty)}</td>` : ""
      }</tr>`,
    )
    .join("");
  const totals = showPrices
    ? `<div class="totals">
        <p>Subtotal: ${inr(order.subtotal_amount || (order.items ?? []).reduce((sum: number, item: any) => sum + Number(item.price || 0) * Number(item.qty || 0), 0))}</p>
        <p>Shipping: ${inr(order.shipping_fee || 0)}</p>
        <p>Packaging: ${inr(order.packaging_fee || 0)}</p>
        <p>Tax: ${inr(order.tax_amount || 0)}</p>
        ${Number(order.discount_amount || 0) > 0 ? `<p>Discount: -${inr(order.discount_amount)}</p>` : ""}
        <h2>Total: ${inr(order.total)}</h2>
      </div>`
    : "";
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(`<!doctype html><html><head><title>${escapeHtml(title)} ${escapeHtml(order.order_number || order.id)}</title>
    <style>body{font-family:Arial,sans-serif;padding:32px;color:#222} table{width:100%;border-collapse:collapse;margin-top:20px} td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}.right{text-align:right}.muted{color:#666;font-size:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.totals{text-align:right;margin-top:20px}.box{border:1px solid #ddd;padding:12px;margin-top:12px}</style>
    </head><body>
    ${settings.logo_url ? `<img src="${escapeHtml(settings.logo_url)}" style="max-height:80px;max-width:220px"/>` : ""}
    <h1>${escapeHtml(title)}</h1>
    <p class="muted">${escapeHtml(settings.business_name)}<br/>${escapeHtml(settings.address)}<br/>${escapeHtml(settings.contact_email)}</p>
    <div class="grid">
      <div><h2>${escapeHtml(order.order_number || order.id)}</h2><p><strong>Customer:</strong> ${escapeHtml(order.customer_name)}<br/><strong>Phone:</strong> ${escapeHtml(order.phone)}<br/><strong>Address:</strong> ${escapeHtml(order.address)}</p></div>
      <div class="box"><strong>Shipping</strong><br/>Courier: ${escapeHtml(order.courier_name || order.shipping_provider || "Manual")}<br/>Tracking: ${escapeHtml(order.tracking_number || "Not assigned")}<br/>ETA: ${escapeHtml(order.estimated_delivery_date || "TBD")}<br/>Status: ${escapeHtml(order.shipping_status || order.operational_status || order.status)}</div>
    </div>
    ${!showPrices && order.internal_notes ? `<p><strong>Internal notes:</strong> ${escapeHtml(order.internal_notes)}</p>` : ""}
    ${!showPrices && order.shipping_notes ? `<p><strong>Shipping notes:</strong> ${escapeHtml(order.shipping_notes)}</p>` : ""}
    <table><thead><tr><th>Product</th><th>Qty</th>${showPrices ? "<th>Price</th><th>Total</th>" : ""}</tr></thead><tbody>${rows}</tbody></table>
    ${totals}
    ${showPrices ? `<p>Payment: ${escapeHtml(order.payment_method)} ${order.payment_utr ? `· UTR ${escapeHtml(order.payment_utr)}` : ""}</p>` : ""}
    </body></html>`);
  win.document.close();
  win.print();
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

// =====================================================================
// VARIANT EDITOR
// =====================================================================

type VariantDraft = {
  id?: string;
  size: string;
  color: string;
  color_hex: string;
  price: string; // optional override, blank = use product price
  stock: number;
  sort_order: number;
};

const emptyVariantDraft = (): VariantDraft => ({
  size: "",
  color: "",
  color_hex: "",
  price: "",
  stock: 0,
  sort_order: 0,
});

function VariantsEditor({ product, onClose }: { product: Product; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: variants = [], isLoading } = useQuery({
    queryKey: ["admin-variants", product.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", product.id)
        .order("sort_order")
        .order("size");
      if (error) throw error;
      return (data ?? []) as Variant[];
    },
  });

  const [draft, setDraft] = useState<VariantDraft | null>(null);

  const save = useMutation({
    mutationFn: async (d: VariantDraft) => {
      const payload = {
        product_id: product.id,
        size: d.size.trim(),
        color: d.color.trim(),
        color_hex: d.color_hex.trim() || null,
        price: d.price.trim() === "" ? null : Math.max(0, Math.round(Number(d.price))),
        stock: Math.max(0, Math.round(d.stock || 0)),
        sort_order: d.sort_order,
      };
      if (d.id) {
        const { error } = await supabase
          .from("product_variants")
          .update(payload)
          .eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("product_variants").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-variants", product.id] });
      qc.invalidateQueries({ queryKey: ["variants", product.id] });
      setDraft(null);
      toast.success("Variant saved.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_variants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-variants", product.id] });
      qc.invalidateQueries({ queryKey: ["variants", product.id] });
      toast.success("Variant removed.");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4">
      <div className="my-8 w-full max-w-2xl rounded-sm border border-border bg-background p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Variants</p>
            <h2 className="mt-1 font-display text-2xl">{product.name}</h2>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={() => setDraft(emptyVariantDraft())}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs uppercase tracking-[0.2em] text-primary-foreground"
          >
            <Plus size={13} /> Add variant
          </button>
        </div>

        {isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : variants.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No variants yet. Use "Add variant" to add sizes and colours; or leave empty to keep
            this as a single-option product (uses base stock).
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
                  <th className="py-2">Size</th>
                  <th className="py-2">Colour</th>
                  <th className="py-2">Price</th>
                  <th className="py-2">Stock</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id} className="border-b border-border/50">
                    <td className="py-2">{v.size || "—"}</td>
                    <td className="py-2">
                      <span className="inline-flex items-center gap-2">
                        {v.color_hex && (
                          <span
                            className="inline-block h-4 w-4 rounded-full border border-border"
                            style={{ backgroundColor: v.color_hex }}
                          />
                        )}
                        {v.color || "—"}
                      </span>
                    </td>
                    <td className="py-2">{v.price != null ? inr(v.price) : "—"}</td>
                    <td className={"py-2 " + (v.stock <= 5 ? "text-primary" : "")}>{v.stock}</td>
                    <td className="flex justify-end gap-2 py-2">
                      <button
                        onClick={() =>
                          setDraft({
                            id: v.id,
                            size: v.size,
                            color: v.color,
                            color_hex: v.color_hex ?? "",
                            price: v.price != null ? String(v.price) : "",
                            stock: v.stock,
                            sort_order: v.sort_order,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Remove this variant?")) remove.mutate(v.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-destructive"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {draft && (
          <div className="mt-6 rounded-sm border border-border bg-secondary/30 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Size (e.g. S, M, L, Free Size)">
                <input
                  className={inputCls}
                  value={draft.size}
                  onChange={(e) => setDraft({ ...draft, size: e.target.value })}
                />
              </Field>
              <Field label="Colour name">
                <input
                  className={inputCls}
                  value={draft.color}
                  onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                />
              </Field>
              <Field label="Colour hex (#RRGGBB, optional)">
                <input
                  className={inputCls}
                  placeholder="#a3b18a"
                  value={draft.color_hex}
                  onChange={(e) => setDraft({ ...draft, color_hex: e.target.value })}
                />
              </Field>
              <Field label="Price override (₹, blank = base price)">
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                />
              </Field>
              <Field label="Stock">
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  value={draft.stock}
                  onChange={(e) => setDraft({ ...draft, stock: Number(e.target.value) })}
                />
              </Field>
              <Field label="Order">
                <input
                  className={inputCls}
                  type="number"
                  value={draft.sort_order}
                  onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
                />
              </Field>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDraft(null)}
                className="rounded-full border border-border px-5 py-2 text-xs uppercase tracking-[0.2em]"
              >
                Cancel
              </button>
              <button
                disabled={save.isPending || (!draft.size && !draft.color)}
                onClick={() => save.mutate(draft)}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-60"
              >
                {save.isPending && <Loader2 size={13} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// REVIEWS MODERATION
// =====================================================================

function ReviewsAdmin() {
  const qc = useQueryClient();
  const db = supabase as any;
  const [selected, setSelected] = useState<string[]>([]);

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () => {
      const { data, error } = await db
        .from("reviews")
        .select("*, products(name, slug)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const moderate = useMutation({
    mutationFn: async ({
      ids,
      status,
      admin_reply,
      rejected_reason,
      featured,
    }: {
      ids: string[];
      status?: string;
      admin_reply?: string | null;
      rejected_reason?: string | null;
      featured?: boolean;
    }) => {
      const payload: Record<string, unknown> = {};
      if (status) {
        payload.status = status;
        payload.approved = status === "approved" || status === "featured";
      }
      if (admin_reply !== undefined) payload.admin_reply = admin_reply;
      if (rejected_reason !== undefined) payload.rejected_reason = rejected_reason;
      if (featured !== undefined) {
        payload.featured = featured;
        if (featured) {
          payload.status = "featured";
          payload.approved = true;
        }
      }
      const { error } = await db
        .from("reviews")
        .update(payload)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      qc.invalidateQueries({ queryKey: ["ratings-summary"] });
      setSelected([]);
      toast.success("Review moderation saved.");
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("reviews").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      qc.invalidateQueries({ queryKey: ["ratings-summary"] });
      toast.success("Review removed.");
    },
  });

  if (isLoading) return <p className="mt-8 text-sm text-muted-foreground">Loading…</p>;
  if (reviews.length === 0)
    return <p className="mt-8 text-sm text-muted-foreground">No reviews yet.</p>;

  return (
    <div className="mt-6 space-y-4">
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-sm border border-border p-3">
          <span className="text-xs text-muted-foreground">{selected.length} selected</span>
          <button
            type="button"
            onClick={() => moderate.mutate({ ids: selected, status: "approved" })}
            className="rounded-full border border-border px-3 py-1.5 text-xs"
          >
            Bulk approve
          </button>
          <button
            type="button"
            onClick={() => moderate.mutate({ ids: selected, status: "hidden" })}
            className="rounded-full border border-border px-3 py-1.5 text-xs"
          >
            Bulk hide
          </button>
        </div>
      )}
      {reviews.map((r: any) => (
        <div key={r.id} className="rounded-sm border border-border p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selected.includes(r.id)}
                onChange={(e) =>
                  setSelected((current) =>
                    e.target.checked ? [...current, r.id] : current.filter((id) => id !== r.id),
                  )
                }
                aria-label={`Select review ${r.id}`}
                className="mt-1"
              />
              <div>
              <p className="font-medium">
                {r.author_name || "Customer"}{" "}
                <span className="text-xs text-muted-foreground">
                  · {r.products?.name ?? "Product removed"}
                </span>
              </p>
              <div className="mt-1 inline-flex items-center gap-1 text-xs">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={13}
                    className={i < r.rating ? "fill-primary text-primary" : "text-muted-foreground"}
                  />
                ))}
              </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => moderate.mutate({ ids: [r.id], status: r.approved ? "hidden" : "approved" })}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs"
              >
                {r.approved ? <EyeOff size={12} /> : <Eye size={12} />}
                {r.approved ? "Hide" : "Show"}
              </button>
              <button
                onClick={() => moderate.mutate({ ids: [r.id], featured: !r.featured })}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs"
              >
                <Star size={12} /> {r.featured ? "Unfeature" : "Feature"}
              </button>
              <button
                onClick={() => {
                  const reply = prompt("Admin reply", r.admin_reply || "");
                  if (reply !== null) moderate.mutate({ ids: [r.id], admin_reply: reply });
                }}
                className="rounded-full border border-border px-3 py-1.5 text-xs"
              >
                Reply
              </button>
              <button
                onClick={() => {
                  const reason = prompt("Reject reason", r.rejected_reason || "") ?? "";
                  moderate.mutate({ ids: [r.id], status: "rejected", rejected_reason: reason });
                }}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-destructive"
              >
                Reject
              </button>
              <button
                onClick={() => {
                  if (confirm("Delete this review?")) remove.mutate(r.id);
                }}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-destructive"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
          {r.title && <p className="mt-2 font-display text-lg">{r.title}</p>}
          <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
          {r.admin_reply && (
            <p className="mt-2 rounded-sm bg-secondary/40 p-3 text-sm">
              <span className="font-medium">Admin reply:</span> {r.admin_reply}
            </p>
          )}
          <p className="mt-2 text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
            {new Date(r.created_at).toLocaleString("en-IN")}
            {" · "}{r.status || (r.approved ? "approved" : "hidden")}
            {r.verified_purchase && " · Verified buyer"}
            {r.featured && " · Featured"}
          </p>
        </div>
      ))}
    </div>
  );
}
