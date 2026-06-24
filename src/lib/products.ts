import { useQuery } from "@tanstack/react-query";
import { publicSupabase } from "@/integrations/supabase/public-client";

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  image_url: string;
  cover_image_url?: string;
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
  active?: boolean;
};

export type ProductImage = {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string;
  sort_order: number;
  is_cover: boolean;
  created_at?: string;
  updated_at?: string;
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

const VISIBLE_PRODUCT_STATUSES = ["active", "out_of_stock"];

const visibleProductQuery = (query: any) =>
  query
    .eq("active", true)
    .or(`product_status.is.null,product_status.in.(${VISIBLE_PRODUCT_STATUSES.join(",")})`);

async function fetchProducts(): Promise<Product[]> {
  const query = publicSupabase
    .from("products")
    .select("*, product_images(image_url,is_cover,sort_order)")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  const { data, error } = await visibleProductQuery(query);
  if (error) {
    console.error("[products] visible products query failed", error);
    throw error;
  }
  return (data ?? []).map((product: any) => {
    const cover = [...(product.product_images ?? [])]
      .sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || Number(a.sort_order || 0) - Number(b.sort_order || 0))[0];
    return {
      ...product,
      cover_image_url: cover?.image_url || product.image_url,
    };
  }) as Product[];
}

export function useProducts() {
  return useQuery({ queryKey: ["products"], queryFn: fetchProducts });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const normalizedSlug = decodeURIComponent(slug || "").trim().toLowerCase();
      const query = publicSupabase
        .from("products")
        .select("*")
        .eq("slug", normalizedSlug);
      const { data, error } = await visibleProductQuery(query).maybeSingle();
      if (error) {
        console.error("[products] product detail query failed", { slug, normalizedSlug, error });
        throw error;
      }
      return data as Product | null;
    },
  });
}

export function useVariants(productId: string | undefined) {
  return useQuery({
    queryKey: ["variants", productId],
    enabled: !!productId,
    queryFn: async (): Promise<Variant[]> => {
      const { data, error } = await publicSupabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId!)
        .eq("active", true)
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
      const { data, error } = await publicSupabase
        .from("product_variants")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Variant[];
    },
  });
}

export function useProductImages(productId: string | undefined) {
  return useQuery({
    queryKey: ["product-images", productId],
    enabled: !!productId,
    queryFn: async (): Promise<ProductImage[]> => {
      const { data, error } = await publicSupabase
        .from("product_images")
        .select("*")
        .eq("product_id", productId!)
        .order("is_cover", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) {
        console.error("[products] product_images query failed", { productId, error });
        return [];
      }
      return (data ?? []) as ProductImage[];
    },
  });
}
