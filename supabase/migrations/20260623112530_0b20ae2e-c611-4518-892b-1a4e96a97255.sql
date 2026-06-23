-- Ensure handle_new_user_role trigger is installed on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- business_settings table for site-wide dynamic settings
CREATE TABLE IF NOT EXISTS public.business_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.business_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.business_settings TO authenticated;
GRANT ALL ON public.business_settings TO service_role;

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_business_settings_updated ON public.business_settings;
CREATE TRIGGER trg_business_settings_updated
  BEFORE UPDATE ON public.business_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Drop any existing policies and recreate cleanly
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT polname FROM pg_policy WHERE polrelid = 'public.business_settings'::regclass LOOP
    EXECUTE format('DROP POLICY %I ON public.business_settings', r.polname);
  END LOOP;
END $$;

-- Anyone (anon OR authenticated) may read non-secret public settings
CREATE POLICY "Public can read non-secret settings"
  ON public.business_settings FOR SELECT
  TO anon, authenticated
  USING (key NOT IN (
    'brevo_api_key','shiprocket_api_key','delhivery_api_key','blue_dart_api_key',
    'india_post_customer_id','razorpay_key_secret','resend_api_key',
    'google_verification_code','meta_pixel_id'
  ));

-- Admins may read every setting (including secrets)
CREATE POLICY "Admins can read all settings"
  ON public.business_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert settings"
  ON public.business_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update settings"
  ON public.business_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete settings"
  ON public.business_settings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed important defaults so anon + authenticated see the same values
INSERT INTO public.business_settings(key, value) VALUES
  ('contact_email','superbcreations55@gmail.com'),
  ('business_email','superbcreations55@gmail.com'),
  ('support_email','superbcreations55@gmail.com'),
  ('phone_number','+91 70062 02496'),
  ('whatsapp_number','917006202496'),
  ('facebook_url','https://www.facebook.com/share/1U22A7sHpi/?mibextid=wwXIfr'),
  ('instagram_url','https://www.instagram.com/superb_creations_?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=='),
  ('youtube_url','https://youtube.com/@superb_creations?si=8gHDjFUhjRMpktts'),
  ('show_facebook','true'),
  ('show_instagram','true'),
  ('show_youtube','true'),
  ('business_name','Superb Creations'),
  ('store_name','Superb Creations'),
  ('upi_id','9205245555@axl')
ON CONFLICT (key) DO NOTHING;