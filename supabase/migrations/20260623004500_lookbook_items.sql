CREATE TABLE IF NOT EXISTS public.lookbook_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  caption text NOT NULL DEFAULT '',
  image_url text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lookbook_items ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_lookbook_items_updated ON public.lookbook_items;
CREATE TRIGGER trg_lookbook_items_updated
  BEFORE UPDATE ON public.lookbook_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT ON public.lookbook_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.lookbook_items TO authenticated;
GRANT ALL ON public.lookbook_items TO service_role;

DROP POLICY IF EXISTS "Public can view active lookbook items" ON public.lookbook_items;
CREATE POLICY "Public can view active lookbook items"
  ON public.lookbook_items
  FOR SELECT
  USING (active = true OR public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can insert lookbook items" ON public.lookbook_items;
CREATE POLICY "Owner can insert lookbook items"
  ON public.lookbook_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can update lookbook items" ON public.lookbook_items;
CREATE POLICY "Owner can update lookbook items"
  ON public.lookbook_items
  FOR UPDATE
  TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can delete lookbook items" ON public.lookbook_items;
CREATE POLICY "Owner can delete lookbook items"
  ON public.lookbook_items
  FOR DELETE
  TO authenticated
  USING (public.is_owner_admin(auth.uid()));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lookbook-images',
  'lookbook-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view lookbook images" ON storage.objects;
CREATE POLICY "Public can view lookbook images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'lookbook-images');

DROP POLICY IF EXISTS "Owner can upload lookbook images" ON storage.objects;
CREATE POLICY "Owner can upload lookbook images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'lookbook-images' AND public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can update lookbook images" ON storage.objects;
CREATE POLICY "Owner can update lookbook images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'lookbook-images' AND public.is_owner_admin(auth.uid()))
  WITH CHECK (bucket_id = 'lookbook-images' AND public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can delete lookbook images" ON storage.objects;
CREATE POLICY "Owner can delete lookbook images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'lookbook-images' AND public.is_owner_admin(auth.uid()));
