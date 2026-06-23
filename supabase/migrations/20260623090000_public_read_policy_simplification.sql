-- Public storefront reads must be identical for anon, normal users, and admins.
-- Public SELECT policies intentionally avoid auth.uid()/is_owner_admin() branches.

GRANT SELECT ON public.business_settings TO anon, authenticated;
GRANT SELECT ON public.products TO anon, authenticated;
GRANT SELECT ON public.lookbook_items TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.business_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.lookbook_items TO authenticated;

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lookbook_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Owner can insert business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Owner can update business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Owner can delete business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Owner can manage business settings" ON public.business_settings;

CREATE POLICY "Public can view business settings"
  ON public.business_settings
  FOR SELECT
  TO anon, authenticated
  USING (key !~* '(api_key|secret|token|password|service_role|private)');

CREATE POLICY "Owner can manage business settings"
  ON public.business_settings
  FOR ALL
  TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
DROP POLICY IF EXISTS "Public can view active products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Owner can insert products" ON public.products;
DROP POLICY IF EXISTS "Owner can update products" ON public.products;
DROP POLICY IF EXISTS "Owner can delete products" ON public.products;

CREATE POLICY "Public can view active products"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE POLICY "Owner can insert products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_owner_admin(auth.uid()));

CREATE POLICY "Owner can update products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

CREATE POLICY "Owner can delete products"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Public can view active lookbook items" ON public.lookbook_items;
DROP POLICY IF EXISTS "Owner can insert lookbook items" ON public.lookbook_items;
DROP POLICY IF EXISTS "Owner can update lookbook items" ON public.lookbook_items;
DROP POLICY IF EXISTS "Owner can delete lookbook items" ON public.lookbook_items;

CREATE POLICY "Public can view active lookbook items"
  ON public.lookbook_items
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE POLICY "Owner can insert lookbook items"
  ON public.lookbook_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_owner_admin(auth.uid()));

CREATE POLICY "Owner can update lookbook items"
  ON public.lookbook_items
  FOR UPDATE
  TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

CREATE POLICY "Owner can delete lookbook items"
  ON public.lookbook_items
  FOR DELETE
  TO authenticated
  USING (public.is_owner_admin(auth.uid()));
