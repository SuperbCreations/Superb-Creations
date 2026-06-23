INSERT INTO public.business_settings (key, value)
VALUES
  ('enable_loyalty', 'true'),
  ('loyalty_earn_rate', '1'),
  ('loyalty_redeem_rate', '1'),
  ('loyalty_min_redemption', '100'),
  ('loyalty_max_redemption_percent', '20'),
  ('loyalty_points_expiry_days', '365'),
  ('enable_referrals', 'true'),
  ('referral_reward_amount', '100'),
  ('referral_expiry_days', '90'),
  ('enable_blog', 'true'),
  ('enable_marketing_popups', 'true'),
  ('enable_social_proof', 'true'),
  ('recent_purchase_window_hours', '72')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.loyalty_points
  ADD COLUMN IF NOT EXISTS pending_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS redeemed_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expired_points integer NOT NULL DEFAULT 0;

ALTER TABLE public.loyalty_point_events
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'adjustment',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS loyalty_point_events_type_created_idx
  ON public.loyalty_point_events(event_type, created_at DESC);

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS reward_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS referrals_referrer_status_idx
  ON public.referrals(referrer_user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.blog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  banner_image_url text NOT NULL DEFAULT '',
  category_id uuid REFERENCES public.blog_categories(id) ON DELETE SET NULL,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  featured boolean NOT NULL DEFAULT false,
  seo_title text NOT NULL DEFAULT '',
  seo_description text NOT NULL DEFAULT '',
  seo_keywords text NOT NULL DEFAULT '',
  canonical_url text NOT NULL DEFAULT '',
  og_image_url text NOT NULL DEFAULT '',
  robots text NOT NULL DEFAULT 'index,follow',
  reading_minutes integer NOT NULL DEFAULT 1,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.page_seo_settings (
  page_key text PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  keywords text NOT NULL DEFAULT '',
  canonical_url text NOT NULL DEFAULT '',
  og_title text NOT NULL DEFAULT '',
  og_description text NOT NULL DEFAULT '',
  og_image_url text NOT NULL DEFAULT '',
  twitter_image_url text NOT NULL DEFAULT '',
  robots text NOT NULL DEFAULT 'index,follow',
  structured_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  popup_type text NOT NULL DEFAULT 'newsletter' CHECK (popup_type IN ('newsletter','discount','exit_intent','welcome','festival','manual')),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  cta_label text NOT NULL DEFAULT '',
  cta_url text NOT NULL DEFAULT '',
  coupon_code text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT false,
  target_pages text[] NOT NULL DEFAULT '{}'::text[],
  frequency text NOT NULL DEFAULT 'once_per_session',
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_popup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  popup_id uuid REFERENCES public.marketing_popups(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('impression','click','dismiss')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recommendation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('trending','popular','best_sellers','similar','frequently_bought_together','recommended_for_you')),
  active boolean NOT NULL DEFAULT true,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  related_product_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_seo_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_popups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_popup_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_rules ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS blog_posts_status_published_idx
  ON public.blog_posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS blog_posts_featured_idx
  ON public.blog_posts(featured, published_at DESC)
  WHERE status = 'published';
CREATE INDEX IF NOT EXISTS marketing_popups_active_window_idx
  ON public.marketing_popups(active, starts_at, ends_at, sort_order);
CREATE INDEX IF NOT EXISTS marketing_popup_events_popup_type_idx
  ON public.marketing_popup_events(popup_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS recommendation_rules_type_active_idx
  ON public.recommendation_rules(rule_type, active, sort_order);

GRANT SELECT ON public.blog_categories, public.blog_posts, public.page_seo_settings, public.marketing_popups, public.recommendation_rules TO anon, authenticated;
GRANT INSERT ON public.marketing_popup_events TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.blog_categories, public.blog_posts, public.page_seo_settings, public.marketing_popups, public.recommendation_rules TO authenticated;
GRANT SELECT ON public.marketing_popup_events TO authenticated;
GRANT ALL ON public.blog_categories, public.blog_posts, public.page_seo_settings, public.marketing_popups, public.marketing_popup_events, public.recommendation_rules TO service_role;

DROP POLICY IF EXISTS "Public can read active blog categories" ON public.blog_categories;
CREATE POLICY "Public can read active blog categories"
  ON public.blog_categories FOR SELECT
  USING (active = true OR public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can manage blog categories" ON public.blog_categories;
CREATE POLICY "Owner can manage blog categories"
  ON public.blog_categories FOR ALL TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Public can read published blog posts" ON public.blog_posts;
CREATE POLICY "Public can read published blog posts"
  ON public.blog_posts FOR SELECT
  USING (status = 'published' OR public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can manage blog posts" ON public.blog_posts;
CREATE POLICY "Owner can manage blog posts"
  ON public.blog_posts FOR ALL TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Public can read SEO settings" ON public.page_seo_settings;
CREATE POLICY "Public can read SEO settings"
  ON public.page_seo_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Owner can manage SEO settings" ON public.page_seo_settings;
CREATE POLICY "Owner can manage SEO settings"
  ON public.page_seo_settings FOR ALL TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Public can read active marketing popups" ON public.marketing_popups;
CREATE POLICY "Public can read active marketing popups"
  ON public.marketing_popups FOR SELECT
  USING (
    active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
    OR public.is_owner_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Owner can manage marketing popups" ON public.marketing_popups;
CREATE POLICY "Owner can manage marketing popups"
  ON public.marketing_popups FOR ALL TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Public can record popup events" ON public.marketing_popup_events;
CREATE POLICY "Public can record popup events"
  ON public.marketing_popup_events FOR INSERT
  WITH CHECK (event_type IN ('impression','click','dismiss'));

DROP POLICY IF EXISTS "Owner can read popup events" ON public.marketing_popup_events;
CREATE POLICY "Owner can read popup events"
  ON public.marketing_popup_events FOR SELECT TO authenticated
  USING (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Public can read active recommendation rules" ON public.recommendation_rules;
CREATE POLICY "Public can read active recommendation rules"
  ON public.recommendation_rules FOR SELECT
  USING (active = true OR public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can manage recommendation rules" ON public.recommendation_rules;
CREATE POLICY "Owner can manage recommendation rules"
  ON public.recommendation_rules FOR ALL TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.generate_referral_code(p_user_id uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT referral_code INTO v_code
  FROM public.referrals
  WHERE referrer_user_id = p_user_id
    AND referred_user_id IS NULL
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  v_code := upper(substr(replace(p_user_id::text, '-', ''), 1, 8));
  INSERT INTO public.referrals (referral_code, referrer_user_id, status, expires_at)
  VALUES (v_code, p_user_id, 'code_created', now() + interval '90 days')
  ON CONFLICT (referral_code) DO NOTHING;

  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_growth_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Owner admin access required';
  END IF;

  RETURN jsonb_build_object(
    'loyalty', jsonb_build_object(
      'activeUsers', (SELECT count(*) FROM public.loyalty_points WHERE points > 0 OR lifetime_points > 0),
      'availablePoints', (SELECT coalesce(sum(points), 0) FROM public.loyalty_points),
      'pendingPoints', (SELECT coalesce(sum(pending_points), 0) FROM public.loyalty_points),
      'redeemedPoints', (SELECT coalesce(sum(redeemed_points), 0) FROM public.loyalty_points),
      'issuedPoints', (SELECT coalesce(sum(points), 0) FROM public.loyalty_point_events WHERE points > 0),
      'redeemedEvents', (SELECT coalesce(abs(sum(points)), 0) FROM public.loyalty_point_events WHERE points < 0)
    ),
    'referrals', jsonb_build_object(
      'total', (SELECT count(*) FROM public.referrals),
      'successful', (SELECT count(*) FROM public.referrals WHERE status IN ('completed','rewarded')),
      'pending', (SELECT count(*) FROM public.referrals WHERE status IN ('pending','code_created')),
      'rewardsIssued', (SELECT coalesce(sum(reward_amount), 0) FROM public.referrals WHERE status IN ('completed','rewarded'))
    ),
    'blog', jsonb_build_object(
      'published', (SELECT count(*) FROM public.blog_posts WHERE status = 'published'),
      'drafts', (SELECT count(*) FROM public.blog_posts WHERE status = 'draft'),
      'featured', (SELECT count(*) FROM public.blog_posts WHERE featured = true AND status = 'published')
    ),
    'marketing', jsonb_build_object(
      'activePopups', (SELECT count(*) FROM public.marketing_popups WHERE active = true),
      'impressions', (SELECT count(*) FROM public.marketing_popup_events WHERE event_type = 'impression'),
      'clicks', (SELECT count(*) FROM public.marketing_popup_events WHERE event_type = 'click')
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_referral_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_referral_code(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_growth_analytics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_growth_analytics() TO authenticated, service_role;
