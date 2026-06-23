INSERT INTO public.business_settings (key, value)
VALUES
  ('store_name', 'Superb Creations'),
  ('logo_url', ''),
  ('favicon_url', ''),
  ('primary_color', '#b07a86'),
  ('secondary_color', '#f7e8e8'),
  ('website_title', 'Superb Creations — Quietly Elegant Women''s Wear'),
  ('website_description', 'Superb Creations is a women''s clothing and beauty boutique — handcrafted kurta sets, dresses, sarees and cosmetics. Order on WhatsApp.'),
  ('copyright_text', 'Superb Creations. All rights reserved.'),
  ('store_status', 'open'),
  ('maintenance_mode', 'false'),
  ('maintenance_message', 'We are refreshing the store. Please check back soon.'),
  ('enable_checkout', 'true'),
  ('enable_orders', 'true'),
  ('enable_whatsapp', 'true'),
  ('enable_upi', 'true'),
  ('enable_razorpay', 'false'),
  ('enable_cod', 'false'),
  ('enable_reviews', 'true'),
  ('enable_wishlist', 'false'),
  ('enable_newsletter', 'false'),
  ('phone_number', '+91 70062 02496'),
  ('address', 'Studio, India'),
  ('city', ''),
  ('state', ''),
  ('country', 'India'),
  ('pincode', ''),
  ('google_maps_link', ''),
  ('business_hours', 'Mon-Sat, 10am-7pm'),
  ('emergency_contact', ''),
  ('pinterest_url', ''),
  ('x_url', ''),
  ('linkedin_url', ''),
  ('threads_url', ''),
  ('website_url', ''),
  ('show_instagram', 'true'),
  ('show_facebook', 'true'),
  ('show_youtube', 'true'),
  ('show_pinterest', 'false'),
  ('show_x', 'false'),
  ('show_linkedin', 'false'),
  ('show_threads', 'false'),
  ('show_website', 'false'),
  ('hero_eyebrow', 'New season · Spring edit'),
  ('hero_title', 'Quietly elegant.'),
  ('hero_subtitle', 'Made for every day.'),
  ('hero_description', 'Hand-finished kurta sets, flowy silhouettes and timeless drapes — designed in soft pastels for the modern Indian wardrobe.'),
  ('hero_button_text', 'Shop the edit'),
  ('hero_button_link', '/shop'),
  ('announcement_bar', 'Free shipping over ₹2,500 ✦ Order on WhatsApp · +91 70062 02496 ✦ Handcrafted in India ✦ New drops every Friday'),
  ('announcement_color', '#ffffff66'),
  ('homepage_banner_url', ''),
  ('featured_collection_title', 'Pieces we love right now'),
  ('featured_collection_description', ''),
  ('lookbook_title', 'An ode to soft mornings.'),
  ('lookbook_description', 'Our spring lookbook celebrates ease — the kind of pieces you pull on without thinking, that quietly turn heads anyway.'),
  ('flat_shipping', '99'),
  ('free_shipping_threshold', '2500'),
  ('express_shipping', 'false'),
  ('estimated_delivery', '3-7 business days'),
  ('international_shipping', 'false'),
  ('cod_available', 'false'),
  ('packaging_charge', '0'),
  ('tax_percentage', '0'),
  ('merchant_name', 'Superb Creations'),
  ('payment_note', 'Superb Creations order'),
  ('payment_timeout_minutes', '30'),
  ('privacy_policy', ''),
  ('shipping_policy', ''),
  ('return_refund_policy', ''),
  ('terms_policy', ''),
  ('support_policy', ''),
  ('seo_keywords', 'women clothing, boutique, kurta sets, sarees, dresses, cosmetics'),
  ('og_image_url', ''),
  ('twitter_image_url', ''),
  ('robots_index', 'true'),
  ('google_verification_code', ''),
  ('google_analytics_id', ''),
  ('meta_pixel_id', ''),
  ('canonical_url', ''),
  ('email_sender_name', 'Superb Creations'),
  ('email_sender_email', ''),
  ('email_reply_to', ''),
  ('email_company_address', ''),
  ('email_footer', 'Thank you for shopping with Superb Creations.'),
  ('email_logo_url', ''),
  ('email_primary_color', '#b07a86'),
  ('email_secondary_color', '#f7e8e8'),
  ('max_upload_size_mb', '5')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.media_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  folder text NOT NULL DEFAULT 'general',
  storage_path text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_media_library_updated ON public.media_library;
CREATE TRIGGER trg_media_library_updated
  BEFORE UPDATE ON public.media_library
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT ON public.media_library TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.media_library TO authenticated;
GRANT ALL ON public.media_library TO service_role;

DROP POLICY IF EXISTS "Public can view media library" ON public.media_library;
CREATE POLICY "Public can view media library"
  ON public.media_library
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Owner can insert media library" ON public.media_library;
CREATE POLICY "Owner can insert media library"
  ON public.media_library
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can update media library" ON public.media_library;
CREATE POLICY "Owner can update media library"
  ON public.media_library
  FOR UPDATE
  TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can delete media library" ON public.media_library;
CREATE POLICY "Owner can delete media library"
  ON public.media_library
  FOR DELETE
  TO authenticated
  USING (public.is_owner_admin(auth.uid()));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-media',
  'business-media',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view business media" ON storage.objects;
CREATE POLICY "Public can view business media"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'business-media');

DROP POLICY IF EXISTS "Owner can upload business media" ON storage.objects;
CREATE POLICY "Owner can upload business media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'business-media' AND public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can update business media" ON storage.objects;
CREATE POLICY "Owner can update business media"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'business-media' AND public.is_owner_admin(auth.uid()))
  WITH CHECK (bucket_id = 'business-media' AND public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can delete business media" ON storage.objects;
CREATE POLICY "Owner can delete business media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'business-media' AND public.is_owner_admin(auth.uid()));
