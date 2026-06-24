import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { publicSupabase } from "@/integrations/supabase/public-client";
import { supabase } from "@/integrations/supabase/client";

const publicDb = publicSupabase as any;
const db = supabase as any;

export type PaymentMethodKey = "upi" | "razorpay" | "cod" | "bank_transfer";

export type PaymentMethod = {
  method_key: PaymentMethodKey;
  display_name: string;
  description: string;
  instructions: string;
  verification_time: string;
  enabled: boolean;
  min_order_amount: number;
  max_order_amount: number | null;
  extra_fee: number;
  sort_order: number;
  recommended: boolean;
  provider: string;
  public_details: Record<string, unknown>;
};

const checkoutMethodKeys = new Set<PaymentMethodKey>([
  "upi",
  "razorpay",
  "cod",
  "bank_transfer",
]);

function normalizePaymentMethod(row: any): PaymentMethod | null {
  const methodKey = String(row?.method_key || "") as PaymentMethodKey;
  if (!checkoutMethodKeys.has(methodKey)) return null;
  return {
    method_key: methodKey,
    display_name: String(row.display_name || methodKey),
    description: String(row.description || ""),
    instructions: String(row.instructions || ""),
    verification_time: String(row.verification_time || ""),
    enabled: row.enabled === true,
    min_order_amount: Number(row.min_order_amount || 0),
    max_order_amount: row.max_order_amount == null ? null : Number(row.max_order_amount),
    extra_fee: Number(row.extra_fee || 0),
    sort_order: Number(row.sort_order || 0),
    recommended: row.recommended === true,
    provider: String(row.provider || "manual"),
    public_details:
      row.public_details && typeof row.public_details === "object"
        ? row.public_details
        : {},
  };
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ["payment-methods"],
    queryFn: async (): Promise<PaymentMethod[]> => {
      const { data, error } = await publicDb
        .from("payment_methods")
        .select("method_key,display_name,description,instructions,verification_time,enabled,min_order_amount,max_order_amount,extra_fee,sort_order,recommended,provider,public_details")
        .eq("enabled", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? [])
        .map(normalizePaymentMethod)
        .filter((method): method is PaymentMethod => Boolean(method));
    },
  });
}

export function useAdminPaymentMethods() {
  return useQuery({
    queryKey: ["admin-payment-methods"],
    queryFn: async (): Promise<PaymentMethod[]> => {
      const { data, error } = await db
        .from("payment_methods")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSavePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (method: Partial<PaymentMethod>) => {
      if (!method.method_key) throw new Error("Payment method key is required.");
      const { error } = await db.from("payment_methods").upsert(
        {
          ...method,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "method_key" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-methods"] });
      qc.invalidateQueries({ queryKey: ["admin-payment-methods"] });
    },
  });
}

export function usePaymentLedger(orderId: string | undefined) {
  return useQuery({
    queryKey: ["payment-ledger", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await db
        .from("payment_ledger")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRefundRequests(orderId?: string) {
  return useQuery({
    queryKey: ["refund-requests", orderId || "all"],
    queryFn: async () => {
      let query = db.from("refund_requests").select("*, orders(order_number, customer_name, total)");
      if (orderId) query = query.eq("order_id", orderId);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePaymentAnalytics() {
  return useQuery({
    queryKey: ["payment-analytics-v2"],
    queryFn: async () => {
      const { data, error } = await db.rpc("get_payment_analytics_v2");
      if (error) throw error;
      return data ?? {};
    },
  });
}
