CREATE TABLE IF NOT EXISTS public.business_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_business_settings_updated ON public.business_settings;
CREATE TRIGGER trg_business_settings_updated
  BEFORE UPDATE ON public.business_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT ON public.business_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.business_settings TO authenticated;
GRANT ALL ON public.business_settings TO service_role;

INSERT INTO public.business_settings (key, value)
VALUES
  ('upi_id', '9205245555@axl'),
  ('business_name', 'Superb Creations'),
  ('contact_email', 'superbcreations55@gmail.com'),
  ('instagram_url', 'https://www.instagram.com/superb_creations_?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=='),
  ('facebook_url', 'https://www.facebook.com/share/1U22A7sHpi/?mibextid=wwXIfr'),
  ('youtube_url', 'https://youtube.com/@superb_creations?si=8gHDjFUhjRMpktts'),
  ('whatsapp_number', '917006202496')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "Public can view business settings" ON public.business_settings;
CREATE POLICY "Public can view business settings"
  ON public.business_settings
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Owner can insert business settings" ON public.business_settings;
CREATE POLICY "Owner can insert business settings"
  ON public.business_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can update business settings" ON public.business_settings;
CREATE POLICY "Owner can update business settings"
  ON public.business_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can delete business settings" ON public.business_settings;
CREATE POLICY "Owner can delete business settings"
  ON public.business_settings
  FOR DELETE
  TO authenticated
  USING (public.is_owner_admin(auth.uid()));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_utr text,
  ADD COLUMN IF NOT EXISTS payment_screenshot_url text,
  ADD COLUMN IF NOT EXISTS payment_rejection_reason text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-screenshots',
  'payment-screenshots',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view payment screenshots" ON storage.objects;
CREATE POLICY "Public can view payment screenshots"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'payment-screenshots');

DROP POLICY IF EXISTS "Authenticated users can upload payment screenshots" ON storage.objects;
CREATE POLICY "Authenticated users can upload payment screenshots"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payment-screenshots');

DROP POLICY IF EXISTS "Owner can delete payment screenshots" ON storage.objects;
CREATE POLICY "Owner can delete payment screenshots"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'payment-screenshots' AND public.is_owner_admin(auth.uid()));
