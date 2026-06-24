-- Final production integration repair.
-- Uses products.product_status as the product archive/delete source of truth.
-- Do not add products.archived_at.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_status text NOT NULL DEFAULT 'active';

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
    SELECT 1
    FROM public.product_images pi
    WHERE pi.product_id = p.id
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

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.products TO anon, authenticated;
GRANT SELECT ON public.product_variants TO anon, authenticated;
GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;

DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
DROP POLICY IF EXISTS "Public can view active products" ON public.products;
CREATE POLICY "Public can view active products"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (
    active = true
    AND (
      product_status IS NULL
      OR product_status NOT IN ('archived', 'deleted', 'draft', 'hidden', 'inactive')
    )
  );

DROP POLICY IF EXISTS "Owner can view all products" ON public.products;
CREATE POLICY "Owner can view all products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Public can read active product images" ON public.product_images;
DROP POLICY IF EXISTS "Public can view active product images" ON public.product_images;
CREATE POLICY "Public can read active product images"
  ON public.product_images
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_images.product_id
        AND p.active = true
        AND (
          p.product_status IS NULL
          OR p.product_status NOT IN ('archived', 'deleted', 'draft', 'hidden', 'inactive')
        )
    )
  );

DROP POLICY IF EXISTS "Owner can view all product images" ON public.product_images;
CREATE POLICY "Owner can view all product images"
  ON public.product_images
  FOR SELECT
  TO authenticated
  USING (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can manage product images" ON public.product_images;
CREATE POLICY "Owner can manage product images"
  ON public.product_images
  FOR ALL
  TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

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

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Owner can upload product images" ON storage.objects;
CREATE POLICY "Owner can upload product images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Owner can update product images" ON storage.objects;
CREATE POLICY "Owner can update product images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_owner_admin(auth.uid()))
  WITH CHECK (bucket_id = 'product-images' AND public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Owner can delete product images" ON storage.objects;
CREATE POLICY "Owner can delete product images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_owner_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.payment_methods (
  method_key text PRIMARY KEY,
  display_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  verification_time text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  min_order_amount numeric NOT NULL DEFAULT 0,
  max_order_amount numeric,
  extra_fee numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  recommended boolean NOT NULL DEFAULT false,
  provider text NOT NULL DEFAULT 'manual',
  public_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  admin_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS instructions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS verification_time text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_order_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_order_amount numeric,
  ADD COLUMN IF NOT EXISTS extra_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recommended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS public_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS admin_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

WITH settings AS (
  SELECT
    COALESCE((SELECT value FROM public.business_settings WHERE key = 'upi_id'), '9205245555@axl') AS upi_id,
    COALESCE((SELECT value FROM public.business_settings WHERE key = 'business_name'), 'Superb Creations') AS business_name
)
INSERT INTO public.payment_methods (
  method_key,
  display_name,
  description,
  instructions,
  verification_time,
  enabled,
  min_order_amount,
  max_order_amount,
  extra_fee,
  sort_order,
  recommended,
  provider,
  public_details
)
SELECT
  method_key,
  display_name,
  description,
  instructions,
  verification_time,
  enabled,
  min_order_amount,
  max_order_amount,
  extra_fee,
  sort_order,
  recommended,
  provider,
  public_details
FROM (
  SELECT 'upi'::text AS method_key, 'Manual UPI Payment'::text AS display_name, 'Pay by any UPI app and submit your UTR for verification.'::text AS description, 'Pay the exact amount to the displayed UPI ID, then submit the UTR/reference.'::text AS instructions, 'Usually verified within business hours.'::text AS verification_time, true AS enabled, 0::numeric AS min_order_amount, null::numeric AS max_order_amount, 0::numeric AS extra_fee, 10 AS sort_order, true AS recommended, 'manual_upi'::text AS provider, jsonb_build_object('upi_id', settings.upi_id, 'payee_name', settings.business_name) AS public_details FROM settings
  UNION ALL SELECT 'razorpay', 'Online Payment', 'Pay instantly by card, UPI, wallet or netbanking through Razorpay.', 'Complete payment securely in the Razorpay checkout window.', 'Instant after successful provider confirmation.', false, 0, null, 0, 20, false, 'razorpay', '{}'::jsonb
  UNION ALL SELECT 'cod', 'Cash on Delivery', 'Pay in cash when your order is delivered.', 'Keep exact change ready. COD orders are confirmed by the store before dispatch.', 'Confirmed by admin before packing.', false, 0, null, 0, 30, false, 'manual_cod', '{}'::jsonb
  UNION ALL SELECT 'bank_transfer', 'Bank Transfer', 'Transfer to the store bank account and submit the transaction reference.', 'Transfer the exact amount to the displayed bank account, then submit the reference.', 'Usually verified within business hours.', false, 0, null, 0, 40, false, 'manual_bank', '{}'::jsonb
) methods
ON CONFLICT (method_key) DO UPDATE
SET
  display_name = COALESCE(NULLIF(public.payment_methods.display_name, ''), EXCLUDED.display_name),
  description = COALESCE(NULLIF(public.payment_methods.description, ''), EXCLUDED.description),
  instructions = COALESCE(NULLIF(public.payment_methods.instructions, ''), EXCLUDED.instructions),
  verification_time = COALESCE(NULLIF(public.payment_methods.verification_time, ''), EXCLUDED.verification_time),
  public_details = CASE
    WHEN public.payment_methods.method_key = 'upi'
      THEN public.payment_methods.public_details || EXCLUDED.public_details
    ELSE public.payment_methods.public_details
  END,
  updated_at = now();

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.payment_methods TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;

DROP POLICY IF EXISTS "Public can read enabled payment methods" ON public.payment_methods;
CREATE POLICY "Public can read enabled payment methods"
  ON public.payment_methods
  FOR SELECT
  TO anon, authenticated
  USING (enabled = true);

DROP POLICY IF EXISTS "Owner can view all payment methods" ON public.payment_methods;
CREATE POLICY "Owner can view all payment methods"
  ON public.payment_methods
  FOR SELECT
  TO authenticated
  USING (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can manage payment methods" ON public.payment_methods;
CREATE POLICY "Owner can manage payment methods"
  ON public.payment_methods
  FOR ALL
  TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

INSERT INTO public.email_templates (key, name, subject, body_html, body_text, category, variables, active)
VALUES (
  'welcome',
  'Welcome',
  'Welcome to {{store_name}}',
  '<p>Hi {{customer_name}}, welcome to {{store_name}}.</p><p>We are happy to have you here.</p>',
  'Hi {{customer_name}}, welcome to {{store_name}}.',
  'account',
  '["customer_name","store_name"]'::jsonb,
  true
)
ON CONFLICT (key) DO UPDATE
SET
  subject = COALESCE(NULLIF(public.email_templates.subject, ''), EXCLUDED.subject),
  body_html = COALESCE(NULLIF(public.email_templates.body_html, ''), EXCLUDED.body_html),
  body_text = COALESCE(NULLIF(public.email_templates.body_text, ''), EXCLUDED.body_text),
  active = true,
  updated_at = now();

ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS permanently_failed_at timestamptz;

CREATE OR REPLACE FUNCTION public.queue_welcome_email_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(NEW.email, '')));
  v_name text := trim(coalesce(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(coalesce(NEW.email, ''), '@', 1),
    'there'
  ));
BEGIN
  IF v_email = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.customer_profiles (user_id, full_name, created_at, updated_at)
  VALUES (NEW.id, COALESCE(NULLIF(v_name, ''), 'there'), now(), now())
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.email_queue (
    recipient,
    user_id,
    template_key,
    subject,
    variables,
    status,
    next_attempt_at,
    idempotency_key,
    max_attempts
  )
  VALUES (
    v_email,
    NEW.id,
    'welcome',
    'Welcome to Superb Creations',
    jsonb_build_object(
      'customer_name', COALESCE(NULLIF(v_name, ''), 'there'),
      'store_name', 'Superb Creations',
      'user_email', v_email
    ),
    'queued',
    now(),
    'welcome:' || NEW.id::text,
    5
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.email_logs(recipient, template_key, subject, status, provider, error, metadata)
    VALUES (
      coalesce(v_email, 'unknown'),
      'welcome',
      'Welcome to Superb Creations',
      'failed',
      'brevo',
      SQLERRM,
      jsonb_build_object('source', 'auth.users.after_insert')
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_welcome_email_for_new_user ON auth.users;
CREATE TRIGGER trg_queue_welcome_email_for_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_welcome_email_for_new_user();
