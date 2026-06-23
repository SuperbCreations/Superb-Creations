import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  image_url: string;
  tag: string | null;
  active: boolean;
  description: string;
  in_stock: boolean;
  stock: number;
  reserved_stock?: number;
  sold_stock?: number;
  damaged_stock?: number;
  returned_stock?: number;
  archived_stock?: number;
  lifetime_sales?: number;
  low_stock_threshold?: number;
  product_status?: string;
  sort_order: number;
  weight_grams?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  fragile?: boolean;
  special_packaging?: boolean;
  shipping_class?: string;
  free_shipping_eligible?: boolean;
};

export type Variant = {
  id: string;
  product_id: string;
  size: string;
  color: string;
  color_hex: string | null;
  price: number | null;
  stock: number;
  reserved_stock?: number;
  sold_stock?: number;
  damaged_stock?: number;
  returned_stock?: number;
  low_stock_threshold?: number;
  sku: string | null;
  sort_order: number;
};

export const variantLabel = (v: Pick<Variant, "size" | "color">) =>
  [v.size, v.color].filter(Boolean).join(" · ") || "Default";

export const effectivePrice = (product: Product, variant?: Variant | null) =>
  variant?.price ?? product.price;

export const effectiveStock = (product: Product, variant?: Variant | null) =>
  variant ? variant.stock : product.stock;

export const CATEGORIES = [
  "Kurta Sets",
  "Dresses",
  "Sarees",
  "Cosmetics",
] as const;

export const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Product[];
}

export function useProducts() {
  return useQuery({ queryKey: ["products"], queryFn: fetchProducts });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      return data as Product | null;
    },
  });
}

export function useVariants(productId: string | undefined) {
  return useQuery({
    queryKey: ["variants", productId],
    enabled: !!productId,
    queryFn: async (): Promise<Variant[]> => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId!)
        .order("sort_order")
        .order("size");
      if (error) throw error;
      return (data ?? []) as Variant[];
    },
  });
}

export function useAllVariants() {
  return useQuery({
    queryKey: ["all-variants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Variant[];
    },
  });
}
