import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/lib/products";
import { trackAnalyticsEvent } from "@/lib/analytics";

const db = supabase as any;

export type CustomerAddress = {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  is_default: boolean;
  is_billing: boolean;
  is_shipping: boolean;
};

export type CouponResult = {
  ok: boolean;
  coupon_id?: string;
  code?: string;
  discount_type?: string;
  discount_amount?: number;
  message: string;
};

export function useCustomerProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["customer-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db
        .from("customer_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveCustomerProfile(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!userId) throw new Error("Please sign in.");
      const { error } = await db.from("customer_profiles").upsert({
        user_id: userId,
        ...payload,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-profile", userId] }),
  });
}

export function useCustomerAddresses(userId: string | undefined) {
  return useQuery({
    queryKey: ["customer-addresses", userId],
    enabled: !!userId,
    queryFn: async (): Promise<CustomerAddress[]> => {
      const { data, error } = await db
        .from("customer_addresses")
        .select("*")
        .eq("user_id", userId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveAddress(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (address: Partial<CustomerAddress>) => {
      if (!userId) throw new Error("Please sign in.");
      if (!address.recipient_name || !address.phone || !address.line1 || !address.city || !address.state || !address.pincode) {
        throw new Error("Please complete the required address fields.");
      }
      if (address.is_default) {
        await db.from("customer_addresses").update({ is_default: false }).eq("user_id", userId);
      }
      const { error } = await db.from("customer_addresses").upsert({
        ...address,
        user_id: userId,
        country: address.country || "India",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-addresses", userId] }),
  });
}

export function useDeleteAddress(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("customer_addresses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-addresses", userId] }),
  });
}

export function useWishlist(userId: string | undefined) {
  return useQuery({
    queryKey: ["wishlist", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Array<{ id: string; product_id: string; products: Product }>> => {
      const { data: wishlistId, error: wishlistError } = await db.rpc("ensure_wishlist", {
        p_user_id: userId,
      });
      if (wishlistError) throw wishlistError;
      const { data, error } = await db
        .from("wishlist_items")
        .select("id, product_id, products(*)")
        .eq("wishlist_id", wishlistId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useToggleWishlist(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, wished }: { productId: string; wished: boolean }) => {
      if (!userId) throw new Error("Please sign in to use wishlist.");
      const { data: wishlistId, error: wishlistError } = await db.rpc("ensure_wishlist", {
        p_user_id: userId,
      });
      if (wishlistError) throw wishlistError;
      if (wished) {
        const { error } = await db
          .from("wishlist_items")
          .delete()
          .eq("wishlist_id", wishlistId)
          .eq("product_id", productId);
        if (error) throw error;
      } else {
        const { error } = await db
          .from("wishlist_items")
          .insert({ wishlist_id: wishlistId, product_id: productId });
        if (error) throw error;
      }
      trackAnalyticsEvent({
        eventType: wished ? "wishlist_remove" : "wishlist_add",
        productId,
        userId,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wishlist", userId] }),
  });
}

export function useValidateCoupon() {
  return useMutation({
    mutationFn: async ({
      code,
      userId,
      subtotal,
      shipping,
    }: {
      code: string;
      userId?: string;
      subtotal: number;
      shipping: number;
    }): Promise<CouponResult> => {
      const { data, error } = await db.rpc("validate_coupon", {
        p_code: code,
        p_user_id: userId || null,
        p_subtotal: subtotal,
        p_shipping: shipping,
      });
      if (error) throw error;
      return data as CouponResult;
    },
  });
}

export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEmailPreferences(userId: string | undefined) {
  return useQuery({
    queryKey: ["email-preferences", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db
        .from("email_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveEmailPreferences(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, boolean>) => {
      if (!userId) throw new Error("Please sign in.");
      const { error } = await db.from("email_preferences").upsert({
        user_id: userId,
        ...payload,
        security_emails: true,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-preferences", userId] }),
  });
}

export function useNewsletterSubscribe() {
  return useMutation({
    mutationFn: async ({ email, userId }: { email: string; userId?: string }) => {
      const normalized = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
        throw new Error("Enter a valid email address.");
      }
      const { error } = await db.from("newsletter_subscribers").upsert(
        {
          email: normalized,
          user_id: userId || null,
          subscribed: true,
          confirmed_at: null,
          source: "website",
          unsubscribed_at: null,
        },
        { onConflict: "email" },
      );
      if (error) throw error;
      trackAnalyticsEvent({
        eventType: "newsletter_signup",
        userId,
        metadata: { source: "website" },
      });
    },
  });
}

export function useLoyalty(userId: string | undefined) {
  return useQuery({
    queryKey: ["loyalty", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: points, error } = await db
        .from("loyalty_points")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      const { data: events, error: eventsError } = await db
        .from("loyalty_point_events")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (eventsError) throw eventsError;
      return {
        points: points?.points ?? 0,
        lifetime_points: points?.lifetime_points ?? 0,
        pending_points: points?.pending_points ?? 0,
        redeemed_points: points?.redeemed_points ?? 0,
        expired_points: points?.expired_points ?? 0,
        enabled: points?.enabled ?? true,
        loyalty_point_events: events ?? [],
      };
    },
  });
}

export function useRecentlyViewed(userId: string | undefined) {
  return useQuery({
    queryKey: ["recently-viewed", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db
        .from("recently_viewed_products")
        .select("product_id, viewed_at, products(*)")
        .eq("user_id", userId)
        .order("viewed_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTrackRecentlyViewed(userId: string | undefined) {
  return useMutation({
    mutationFn: async (productId: string) => {
      if (!userId) return;
      const { error } = await db.from("recently_viewed_products").upsert(
        {
          user_id: userId,
          product_id: productId,
          viewed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,product_id" },
      );
      if (error) throw error;
    },
  });
}
