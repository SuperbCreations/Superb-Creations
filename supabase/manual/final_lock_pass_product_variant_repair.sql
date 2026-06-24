-- Final lock-pass repair for product variants.
-- Reuses public.product_variants; does not add products.archived_at.

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS color_hex text,
  ADD COLUMN IF NOT EXISTS price numeric,
  ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

UPDATE public.product_variants
SET active = true
WHERE active IS NULL;

CREATE INDEX IF NOT EXISTS product_variants_product_active_sort_idx
  ON public.product_variants(product_id, active, sort_order, size, color);

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_sku_unique
  ON public.product_variants(lower(sku))
  WHERE sku IS NOT NULL AND sku <> '';

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.product_variants TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;

DROP POLICY IF EXISTS "Public can read active product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Public can view active product variants" ON public.product_variants;
CREATE POLICY "Public can view active product variants"
  ON public.product_variants
  FOR SELECT
  TO anon, authenticated
  USING (
    active = true
    AND EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_variants.product_id
        AND p.active = true
        AND (
          p.product_status IS NULL
          OR p.product_status NOT IN ('archived', 'deleted', 'draft', 'hidden', 'inactive')
        )
    )
  );

DROP POLICY IF EXISTS "Owner can view all product variants" ON public.product_variants;
CREATE POLICY "Owner can view all product variants"
  ON public.product_variants
  FOR SELECT
  TO authenticated
  USING (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can insert product variants" ON public.product_variants;
CREATE POLICY "Owner can insert product variants"
  ON public.product_variants
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can update product variants" ON public.product_variants;
CREATE POLICY "Owner can update product variants"
  ON public.product_variants
  FOR UPDATE
  TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can delete product variants" ON public.product_variants;
CREATE POLICY "Owner can delete product variants"
  ON public.product_variants
  FOR DELETE
  TO authenticated
  USING (public.is_owner_admin(auth.uid()));
