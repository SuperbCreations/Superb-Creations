ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  alt_text text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_cover boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_images_product_sort_idx
  ON public.product_images(product_id, is_cover DESC, sort_order ASC, created_at ASC);

CREATE UNIQUE INDEX IF NOT EXISTS product_images_single_cover_idx
  ON public.product_images(product_id)
  WHERE is_cover = true;

INSERT INTO public.product_images(product_id, image_url, alt_text, sort_order, is_cover)
SELECT p.id, p.image_url, p.name, 0, true
FROM public.products p
WHERE coalesce(p.image_url, '') <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.product_images pi
    WHERE pi.product_id = p.id
      AND pi.image_url = p.image_url
  )
ON CONFLICT DO NOTHING;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY product_id ORDER BY is_cover DESC, sort_order ASC, created_at ASC) AS rn
  FROM public.product_images
)
UPDATE public.product_images pi
SET is_cover = ranked.rn = 1
FROM ranked
WHERE ranked.id = pi.id;

CREATE OR REPLACE FUNCTION public.ensure_single_product_image_cover()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_cover THEN
    UPDATE public.product_images
    SET is_cover = false, updated_at = now()
    WHERE product_id = NEW.product_id
      AND id <> NEW.id;

    UPDATE public.products
    SET image_url = NEW.image_url
    WHERE id = NEW.product_id;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_images_single_cover ON public.product_images;
CREATE TRIGGER trg_product_images_single_cover
  BEFORE INSERT OR UPDATE ON public.product_images
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_product_image_cover();

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;

DROP POLICY IF EXISTS "Public can read active product images" ON public.product_images;
CREATE POLICY "Public can read active product images"
  ON public.product_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_images.product_id
        AND p.active = true
    )
    OR public.is_owner_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Owner can manage product images" ON public.product_images;
CREATE POLICY "Owner can manage product images"
  ON public.product_images
  FOR ALL
  TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Public can view active product variants" ON public.product_variants;
CREATE POLICY "Public can view active product variants"
  ON public.product_variants
  FOR SELECT
  USING (
    public.is_owner_admin(auth.uid())
    OR (
      active = true
      AND EXISTS (
        SELECT 1
        FROM public.products p
        WHERE p.id = product_variants.product_id
          AND p.active = true
      )
    )
  );

