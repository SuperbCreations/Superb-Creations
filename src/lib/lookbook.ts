import { useQuery } from "@tanstack/react-query";
import { publicSupabase } from "@/integrations/supabase/public-client";

export type LookbookItem = {
  id: string;
  title: string;
  caption: string;
  image_url: string;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export async function fetchActiveLookbookItems(): Promise<LookbookItem[]> {
  const { data, error } = await publicSupabase
    .from("lookbook_items")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LookbookItem[];
}

export function useLookbookItems() {
  return useQuery({ queryKey: ["lookbook-items"], queryFn: fetchActiveLookbookItems });
}
