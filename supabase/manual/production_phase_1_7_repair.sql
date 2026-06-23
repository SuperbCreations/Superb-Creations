-- Production repair for Superb Creations Phase 1-7.
-- Safe to run in Supabase SQL Editor on project jjzsoessdaghmfrnfwxj.
-- Run only against the Superb Creations production Supabase project.

CREATE OR REPLACE FUNCTION public.is_owner_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = _user_id
      AND lower(u.email) = 'superbcreations55@gmail.com'
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_owner_admin(uuid) TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'app_role'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$
        SELECT _role = 'admin'::public.app_role
          AND public.is_owner_admin(_user_id)
      $body$
    $fn$;

    GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    DELETE FROM public.user_roles
    WHERE role::text = 'admin'
      AND user_id NOT IN (
        SELECT id
        FROM auth.users
        WHERE lower(email) = 'superbcreations55@gmail.com'
      );

    INSERT INTO public.user_roles (user_id, role)
    SELECT id, 'admin'::public.app_role
    FROM auth.users
    WHERE lower(email) = 'superbcreations55@gmail.com'
    ON CONFLICT (user_id, role) DO NOTHING;

    ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
    REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;

    DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

    CREATE POLICY "Users can view their own roles"
      ON public.user_roles
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id OR public.is_owner_admin(auth.uid()));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.business_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.business_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.business_settings TO authenticated;
GRANT ALL ON public.business_settings TO service_role;

DROP POLICY IF EXISTS "Public can view business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Owner can insert business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Owner can update business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Owner can delete business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Owner can manage business settings" ON public.business_settings;

CREATE POLICY "Public can view business settings"
  ON public.business_settings
  FOR SELECT
  TO anon, authenticated
  USING (
    public.is_owner_admin(auth.uid())
    OR key !~* '(api_key|secret|token|password|service_role|private)'
  );

CREATE POLICY "Owner can manage business settings"
  ON public.business_settings
  FOR ALL
  TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

INSERT INTO public.business_settings (key, value)
VALUES
  ('store_name', 'Superb Creations'),
  ('business_name', 'Superb Creations'),
  ('logo_url', ''),
  ('contact_email', 'superbcreations55@gmail.com'),
  ('support_email', 'superbcreations55@gmail.com'),
  ('business_email', 'superbcreations55@gmail.com'),
  ('phone_number', '+91 70062 02496'),
  ('whatsapp_number', '917006202496'),
  ('address', 'Studio, India'),
  ('city', ''),
  ('state', ''),
  ('country', 'India'),
  ('business_hours', 'Mon-Sat, 10am-7pm'),
  ('enable_whatsapp', 'true'),
  ('facebook_url', 'https://www.facebook.com/share/1U22A7sHpi/?mibextid=wwXIfr'),
  ('instagram_url', 'https://www.instagram.com/superb_creations_?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=='),
  ('youtube_url', 'https://youtube.com/@superb_creations?si=8gHDjFUhjRMpktts'),
  ('show_facebook', 'true'),
  ('show_instagram', 'true'),
  ('show_youtube', 'true')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();
