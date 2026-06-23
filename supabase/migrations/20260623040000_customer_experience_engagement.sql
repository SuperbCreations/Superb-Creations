CREATE TABLE IF NOT EXISTS public.customer_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  date_of_birth date,
  gender text,
  profile_picture_url text NOT NULL DEFAULT '',
  preferred_language text NOT NULL DEFAULT 'en',
  notification_preferences jsonb NOT NULL DEFAULT '{"order_updates":true,"payment_updates":true,"shipping_updates":true,"coupons":true,"announcements":true,"wishlist_alerts":true,"review_requests":true}'::jsonb,
  delete_requested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_customer_profiles_updated ON public.customer_profiles;
CREATE TRIGGER trg_customer_profiles_updated
  BEFORE UPDATE ON public.customer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_profiles TO authenticated;
GRANT ALL ON public.customer_profiles TO service_role;

DROP POLICY IF EXISTS "Customers can manage own profile" ON public.customer_profiles;
CREATE POLICY "Customers can manage own profile"
  ON public.customer_profiles
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR public.is_owner_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_owner_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home',
  recipient_name text NOT NULL,
  phone text NOT NULL,
  line1 text NOT NULL,
  line2 text NOT NULL DEFAULT '',
  city text NOT NULL,
  state text NOT NULL,
  country text NOT NULL DEFAULT 'India',
  pincode text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_billing boolean NOT NULL DEFAULT false,
  is_shipping boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS customer_addresses_user_idx ON public.customer_addresses(user_id, is_default DESC);

DROP TRIGGER IF EXISTS trg_customer_addresses_updated ON public.customer_addresses;
CREATE TRIGGER trg_customer_addresses_updated
  BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;

DROP POLICY IF EXISTS "Customers can manage own addresses" ON public.customer_addresses;
CREATE POLICY "Customers can manage own addresses"
  ON public.customer_addresses
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR public.is_owner_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_owner_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_id uuid NOT NULL REFERENCES public.wishlists(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wishlist_id, product_id)
);

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS wishlist_items_product_idx ON public.wishlist_items(product_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist_items TO authenticated;
GRANT ALL ON public.wishlists TO service_role;
GRANT ALL ON public.wishlist_items TO service_role;

DROP POLICY IF EXISTS "Customers can manage own wishlist" ON public.wishlists;
CREATE POLICY "Customers can manage own wishlist"
  ON public.wishlists
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR public.is_owner_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Customers can manage own wishlist items" ON public.wishlist_items;
CREATE POLICY "Customers can manage own wishlist items"
  ON public.wishlist_items
  FOR ALL
  TO authenticated
  USING (
    public.is_owner_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.wishlists w
      WHERE w.id = wishlist_items.wishlist_id AND w.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_owner_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.wishlists w
      WHERE w.id = wishlist_items.wishlist_id AND w.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.can_review_product(p_product_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    CROSS JOIN LATERAL jsonb_array_elements(o.items) item
    WHERE o.user_id = p_user_id
      AND o.payment_status IN ('approved', 'paid', 'manual_confirmed')
      AND (o.status IN ('confirmed', 'processing', 'packed', 'ready_to_ship', 'shipped', 'delivered', 'completed')
        OR o.operational_status IN ('payment_approved', 'processing', 'packed', 'ready_to_ship', 'shipped', 'delivered', 'completed'))
      AND (item->>'product_id')::uuid = p_product_id
  );
$$;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verified_purchase boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_reply text,
  ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rejected_reason text;

DROP POLICY IF EXISTS "Users can insert their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update their own unapproved reviews" ON public.reviews;
CREATE POLICY "Verified buyers can insert own reviews"
  ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_review_product(product_id, auth.uid())
  );

CREATE POLICY "Verified buyers can update own pending reviews"
  ON public.reviews
  FOR UPDATE
  TO authenticated
  USING (
    (user_id = auth.uid() AND approved = false)
    OR public.is_owner_admin(auth.uid())
  )
  WITH CHECK (
    (user_id = auth.uid() AND public.can_review_product(product_id, auth.uid()))
    OR public.is_owner_admin(auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.review_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.review_images ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS review_images_review_idx ON public.review_images(review_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_images TO authenticated;
GRANT ALL ON public.review_images TO service_role;

DROP POLICY IF EXISTS "Public can view approved review images" ON public.review_images;
CREATE POLICY "Public can view approved review images"
  ON public.review_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_images.review_id AND r.approved = true
    )
    OR user_id = auth.uid()
    OR public.is_owner_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Customers can manage own review images" ON public.review_images;
CREATE POLICY "Customers can manage own review images"
  ON public.review_images
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR public.is_owner_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_owner_admin(auth.uid()));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-images',
  'review-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view review images" ON storage.objects;
CREATE POLICY "Public can view review images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'review-images');

DROP POLICY IF EXISTS "Users can upload review images" ON storage.objects;
CREATE POLICY "Users can upload review images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'review-images');

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'flat', 'free_shipping')),
  discount_value numeric NOT NULL DEFAULT 0,
  minimum_purchase numeric NOT NULL DEFAULT 0,
  maximum_discount numeric,
  expires_at timestamptz,
  usage_limit integer,
  per_user_limit integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  auto_apply boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS coupons_code_idx ON public.coupons(lower(code));
CREATE INDEX IF NOT EXISTS coupons_active_auto_idx ON public.coupons(active, auto_apply, expires_at);
CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_user_idx ON public.coupon_redemptions(coupon_id, user_id);

DROP TRIGGER IF EXISTS trg_coupons_updated ON public.coupons;
CREATE TRIGGER trg_coupons_updated
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT ON public.coupons TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT SELECT, INSERT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupons TO service_role;
GRANT ALL ON public.coupon_redemptions TO service_role;

DROP POLICY IF EXISTS "Public can view active coupons" ON public.coupons;
CREATE POLICY "Public can view active coupons"
  ON public.coupons
  FOR SELECT
  USING (active = true OR public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can manage coupons" ON public.coupons;
CREATE POLICY "Owner can manage coupons"
  ON public.coupons
  FOR ALL
  TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view own coupon redemptions" ON public.coupon_redemptions;
CREATE POLICY "Users can view own coupon redemptions"
  ON public.coupon_redemptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_owner_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  initial_balance numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  issued_to_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gift_card_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id uuid NOT NULL REFERENCES public.gift_cards(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  transaction_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_card_transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS gift_cards_code_idx ON public.gift_cards(lower(code));
GRANT SELECT ON public.gift_cards TO authenticated;
GRANT SELECT ON public.gift_card_transactions TO authenticated;
GRANT ALL ON public.gift_cards TO service_role;
GRANT ALL ON public.gift_card_transactions TO service_role;

DROP POLICY IF EXISTS "Owner can manage gift cards" ON public.gift_cards;
CREATE POLICY "Owner can manage gift cards"
  ON public.gift_cards
  FOR ALL
  TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can manage gift card transactions" ON public.gift_card_transactions;
CREATE POLICY "Owner can manage gift card transactions"
  ON public.gift_card_transactions
  FOR ALL
  TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link_url text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT INSERT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

DROP POLICY IF EXISTS "Customers can read own notifications" ON public.notifications;
CREATE POLICY "Customers can read own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Customers can update own notifications" ON public.notifications;
CREATE POLICY "Customers can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_owner_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can create notifications" ON public.notifications;
CREATE POLICY "Owner can create notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_owner_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subscribed boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'website',
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS newsletter_email_idx ON public.newsletter_subscribers(lower(email));
GRANT INSERT ON public.newsletter_subscribers TO anon, authenticated;
GRANT SELECT, UPDATE ON public.newsletter_subscribers TO authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;

DROP POLICY IF EXISTS "Anyone can subscribe newsletter" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can subscribe newsletter"
  ON public.newsletter_subscribers
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own newsletter subscription" ON public.newsletter_subscribers;
CREATE POLICY "Users can view own newsletter subscription"
  ON public.newsletter_subscribers
  FOR SELECT
  USING (public.is_owner_admin(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own newsletter subscription" ON public.newsletter_subscribers;
CREATE POLICY "Users can update own newsletter subscription"
  ON public.newsletter_subscribers
  FOR UPDATE
  USING (public.is_owner_admin(auth.uid()) OR user_id = auth.uid())
  WITH CHECK (public.is_owner_admin(auth.uid()) OR user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.loyalty_points (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  lifetime_points integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loyalty_point_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points integer NOT NULL,
  reason text NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_point_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS loyalty_point_events_user_idx ON public.loyalty_point_events(user_id, created_at DESC);
GRANT SELECT ON public.loyalty_points TO authenticated;
GRANT SELECT ON public.loyalty_point_events TO authenticated;
GRANT ALL ON public.loyalty_points TO service_role;
GRANT ALL ON public.loyalty_point_events TO service_role;

DROP POLICY IF EXISTS "Users can view own loyalty points" ON public.loyalty_points;
CREATE POLICY "Users can view own loyalty points"
  ON public.loyalty_points
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can manage loyalty points" ON public.loyalty_points;
CREATE POLICY "Owner can manage loyalty points"
  ON public.loyalty_points
  FOR ALL
  TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view own loyalty events" ON public.loyalty_point_events;
CREATE POLICY "Users can view own loyalty events"
  ON public.loyalty_point_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_owner_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code text NOT NULL UNIQUE,
  referrer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  reward jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS referrals_code_idx ON public.referrals(lower(referral_code));
GRANT SELECT, INSERT, UPDATE ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
CREATE POLICY "Users can view own referrals"
  ON public.referrals
  FOR SELECT
  TO authenticated
  USING (
    referrer_user_id = auth.uid()
    OR referred_user_id = auth.uid()
    OR public.is_owner_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Users can create own referral code" ON public.referrals;
CREATE POLICY "Users can create own referral code"
  ON public.referrals
  FOR INSERT
  TO authenticated
  WITH CHECK (referrer_user_id = auth.uid() OR public.is_owner_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.recently_viewed_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id text,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id),
  UNIQUE (anonymous_id, product_id)
);

ALTER TABLE public.recently_viewed_products ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS recently_viewed_user_idx ON public.recently_viewed_products(user_id, viewed_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recently_viewed_products TO authenticated;
GRANT ALL ON public.recently_viewed_products TO service_role;

DROP POLICY IF EXISTS "Users can manage own recently viewed" ON public.recently_viewed_products;
CREATE POLICY "Users can manage own recently viewed"
  ON public.recently_viewed_products
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR public.is_owner_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_owner_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.can_review_product(p_product_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    CROSS JOIN LATERAL jsonb_array_elements(o.items) item
    WHERE o.user_id = p_user_id
      AND o.payment_status IN ('approved', 'paid', 'manual_confirmed')
      AND (o.status IN ('confirmed', 'processing', 'packed', 'ready_to_ship', 'shipped', 'delivered', 'completed')
        OR o.operational_status IN ('payment_approved', 'processing', 'packed', 'ready_to_ship', 'shipped', 'delivered', 'completed'))
      AND (item->>'product_id')::uuid = p_product_id
  );
$$;

CREATE OR REPLACE FUNCTION public.validate_coupon(
  p_code text,
  p_user_id uuid,
  p_subtotal numeric,
  p_shipping numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon public.coupons%ROWTYPE;
  v_total_uses integer;
  v_user_uses integer;
  v_discount numeric := 0;
BEGIN
  SELECT *
  INTO v_coupon
  FROM public.coupons
  WHERE lower(code) = lower(trim(p_code))
    AND active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Coupon not found.');
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Coupon has expired.');
  END IF;

  IF p_subtotal < v_coupon.minimum_purchase THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Minimum purchase not met.');
  END IF;

  SELECT count(*) INTO v_total_uses FROM public.coupon_redemptions WHERE coupon_id = v_coupon.id;
  IF v_coupon.usage_limit IS NOT NULL AND v_total_uses >= v_coupon.usage_limit THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Coupon usage limit reached.');
  END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT count(*) INTO v_user_uses
    FROM public.coupon_redemptions
    WHERE coupon_id = v_coupon.id AND user_id = p_user_id;
    IF v_user_uses >= v_coupon.per_user_limit THEN
      RETURN jsonb_build_object('ok', false, 'message', 'You have already used this coupon.');
    END IF;
  END IF;

  IF v_coupon.discount_type = 'percentage' THEN
    v_discount := round(p_subtotal * v_coupon.discount_value / 100);
    IF v_coupon.maximum_discount IS NOT NULL THEN
      v_discount := LEAST(v_discount, v_coupon.maximum_discount);
    END IF;
  ELSIF v_coupon.discount_type = 'flat' THEN
    v_discount := LEAST(v_coupon.discount_value, p_subtotal);
  ELSIF v_coupon.discount_type = 'free_shipping' THEN
    v_discount := p_shipping;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'discount_type', v_coupon.discount_type,
    'discount_amount', GREATEST(v_discount, 0),
    'message', 'Coupon applied.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.add_loyalty_points(
  p_user_id uuid,
  p_points integer,
  p_reason text,
  p_order_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.loyalty_points (user_id, points, lifetime_points)
  VALUES (p_user_id, GREATEST(p_points, 0), GREATEST(p_points, 0))
  ON CONFLICT (user_id)
  DO UPDATE SET
    points = GREATEST(public.loyalty_points.points + p_points, 0),
    lifetime_points = public.loyalty_points.lifetime_points + GREATEST(p_points, 0),
    updated_at = now();

  INSERT INTO public.loyalty_point_events (user_id, points, reason, order_id)
  VALUES (p_user_id, p_points, p_reason, p_order_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_wishlist(p_user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.wishlists (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_review_product(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_review_product(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.validate_coupon(text, uuid, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, uuid, numeric, numeric) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.add_loyalty_points(uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_loyalty_points(uuid, integer, text, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_wishlist(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_wishlist(uuid) TO authenticated, service_role;
