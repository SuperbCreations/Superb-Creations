import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { publicSupabase } from "@/integrations/supabase/public-client";
import { trackAnalyticsEvent } from "@/lib/analytics";
const publicDb = publicSupabase as any;
const db = supabase as any;

export type Review = {
  id: string;
  product_id: string;
  user_id: string;
  author_name: string;
  rating: number;
  title: string;
  body: string;
  approved: boolean;
  status?: string;
  verified_purchase?: boolean;
  featured?: boolean;
  admin_reply?: string | null;
  images?: string[];
  created_at: string;
};

export function useReviews(productId: string | undefined) {
  return useQuery({
    queryKey: ["reviews", productId],
    enabled: !!productId,
    queryFn: async (): Promise<Review[]> => {
      const { data, error } = await publicDb
        .from("reviews")
        .select("*")
        .eq("product_id", productId!)
        .eq("approved", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Review[];
    },
  });
}

export function useAllProductRatings() {
  return useQuery({
    queryKey: ["ratings-summary"],
    queryFn: async () => {
      const { data, error } = await publicDb
        .from("reviews")
        .select("product_id, rating")
        .eq("approved", true);
      if (error) throw error;
      const map = new Map<string, { sum: number; count: number }>();
      for (const r of data ?? []) {
        const cur = map.get(r.product_id) ?? { sum: 0, count: 0 };
        cur.sum += r.rating;
        cur.count += 1;
        map.set(r.product_id, cur);
      }
      const out: Record<string, { avg: number; count: number }> = {};
      for (const [pid, v] of map) {
        out[pid] = { avg: v.sum / v.count, count: v.count };
      }
      return out;
    },
  });
}

export function useSubmitReview(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      rating: number;
      title: string;
      body: string;
      author_name: string;
      user_id: string;
      images?: string[];
    }) => {
      const { data: canReview, error: canReviewError } = await db.rpc("can_review_product", {
        p_product_id: productId,
        p_user_id: input.user_id,
      });
      if (canReviewError) throw canReviewError;
      if (!canReview) throw new Error("Only verified buyers can review this product.");

      const { error } = await db.from("reviews").upsert(
        {
          product_id: productId,
          user_id: input.user_id,
          author_name: input.author_name,
          rating: input.rating,
          title: input.title,
          body: input.body,
          images: input.images ?? [],
          verified_purchase: true,
          approved: false,
          status: "pending",
        },
        { onConflict: "product_id,user_id" },
      );
      if (error) throw error;
      trackAnalyticsEvent({
        eventType: "review_submitted",
        productId,
        userId: input.user_id,
        metadata: { rating: input.rating },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews", productId] });
      qc.invalidateQueries({ queryKey: ["ratings-summary"] });
    },
  });
}
