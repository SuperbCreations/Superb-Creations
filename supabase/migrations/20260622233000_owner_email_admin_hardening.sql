CREATE OR REPLACE FUNCTION public.is_owner_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = _user_id
      AND lower(email) = 'superbcreations55@gmail.com'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _role = 'admin'::public.app_role AND public.is_owner_admin(_user_id);
$$;

CREATE OR REPLACE FUNCTION public.ensure_my_role()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    auth.uid(),
    CASE
      WHEN public.is_owner_admin(auth.uid()) THEN 'admin'::public.app_role
      ELSE 'user'::public.app_role
    END
  )
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE
      WHEN lower(NEW.email) = 'superbcreations55@gmail.com' THEN 'admin'::public.app_role
      ELSE 'user'::public.app_role
    END
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DELETE FROM public.user_roles
WHERE role = 'admin'::public.app_role
  AND NOT public.is_owner_admin(user_id);

REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_my_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_my_role() TO service_role;
REVOKE EXECUTE ON FUNCTION public.is_owner_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_owner_admin(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.razorpay_webhook_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reviews
  ALTER COLUMN approved SET DEFAULT false;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Users can view their own owner-derived role"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Public can view active products"
  ON public.products
  FOR SELECT
  USING (in_stock = true OR public.is_owner_admin(auth.uid()));
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

DROP POLICY IF EXISTS "Anyone can view variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can insert variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can update variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can delete variants" ON public.product_variants;
CREATE POLICY "Public can view active product variants"
  ON public.product_variants
  FOR SELECT
  USING (
    public.is_owner_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_variants.product_id
        AND p.in_stock = true
    )
  );
CREATE POLICY "Owner can insert variants"
  ON public.product_variants
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_owner_admin(auth.uid()));
CREATE POLICY "Owner can update variants"
  ON public.product_variants
  FOR UPDATE
  TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));
CREATE POLICY "Owner can delete variants"
  ON public.product_variants
  FOR DELETE
  TO authenticated
  USING (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated;
GRANT SELECT ON public.orders TO authenticated;
CREATE POLICY "Owner can view all orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (public.is_owner_admin(auth.uid()));
CREATE POLICY "Users can view their own orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view approved reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can insert their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admins can moderate reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admins can delete any review" ON public.reviews;
CREATE POLICY "Public can view approved reviews"
  ON public.reviews
  FOR SELECT
  USING (approved = true OR auth.uid() = user_id OR public.is_owner_admin(auth.uid()));
CREATE POLICY "Users can insert their own reviews"
  ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND approved = false);
CREATE POLICY "Users can update their own unapproved reviews"
  ON public.reviews
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND approved = false)
  WITH CHECK (auth.uid() = user_id AND approved = false);
CREATE POLICY "Users can delete their own reviews"
  ON public.reviews
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Owner can moderate reviews"
  ON public.reviews
  FOR UPDATE
  TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));
CREATE POLICY "Owner can delete any review"
  ON public.reviews
  FOR DELETE
  TO authenticated
  USING (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view webhook events" ON public.razorpay_webhook_events;
CREATE POLICY "Owner can view webhook events"
  ON public.razorpay_webhook_events
  FOR SELECT
  TO authenticated
  USING (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;
CREATE POLICY "Public can view product images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'product-images');
CREATE POLICY "Owner can upload product images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_owner_admin(auth.uid()));
CREATE POLICY "Owner can update product images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_owner_admin(auth.uid()))
  WITH CHECK (bucket_id = 'product-images' AND public.is_owner_admin(auth.uid()));
CREATE POLICY "Owner can delete product images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_owner_admin(auth.uid()));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
