-- Production checkpoint repair for partially migrated Phase 1-7 databases.
-- Safe to run after all earlier migrations on project jjzsoessdaghmfrnfwxj.

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
    OR (
      key !~* '(api_key|secret|token|password|service_role|private)'
    )
  );

CREATE POLICY "Owner can manage business settings"
  ON public.business_settings
  FOR ALL
  TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

INSERT INTO public.business_settings (key, value)
VALUES
  ('contact_email', 'superbcreations55@gmail.com'),
  ('support_email', 'superbcreations55@gmail.com'),
  ('business_email', 'superbcreations55@gmail.com'),
  ('facebook_url', 'https://www.facebook.com/share/1U22A7sHpi/?mibextid=wwXIfr'),
  ('show_facebook', 'true')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();
