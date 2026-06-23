CREATE TABLE IF NOT EXISTS public.system_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  severity text NOT NULL DEFAULT 'error' CHECK (severity IN ('debug','info','warning','error','critical')),
  message text NOT NULL,
  stack text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_path text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_key text NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cron_run_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task text NOT NULL,
  status text NOT NULL DEFAULT 'started',
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS permanently_failed_at timestamptz;

ALTER TABLE public.system_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_run_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS system_error_logs_created_idx ON public.system_error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS system_error_logs_unresolved_idx ON public.system_error_logs(resolved, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_entity_idx ON public.admin_audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rate_limit_events_key_created_idx ON public.rate_limit_events(rate_key, created_at DESC);
CREATE INDEX IF NOT EXISTS cron_run_logs_task_started_idx ON public.cron_run_logs(task, started_at DESC);

GRANT INSERT ON public.system_error_logs TO anon, authenticated;
GRANT SELECT, UPDATE ON public.system_error_logs TO authenticated;
GRANT SELECT ON public.admin_audit_logs, public.cron_run_logs TO authenticated;
GRANT ALL ON public.system_error_logs, public.admin_audit_logs, public.rate_limit_events, public.cron_run_logs TO service_role;

DROP POLICY IF EXISTS "Public can record safe system errors" ON public.system_error_logs;
CREATE POLICY "Public can record safe system errors"
  ON public.system_error_logs
  FOR INSERT
  WITH CHECK (
    source IN ('client','checkout','analytics','reviews','growth','newsletter','webhook','server','cron')
    AND severity IN ('debug','info','warning','error','critical')
    AND octet_length(message) <= 2000
    AND (stack IS NULL OR octet_length(stack) <= 6000)
    AND jsonb_typeof(metadata) = 'object'
    AND octet_length(metadata::text) <= 4000
  );

DROP POLICY IF EXISTS "Owner can manage system errors" ON public.system_error_logs;
CREATE POLICY "Owner can manage system errors"
  ON public.system_error_logs
  FOR ALL TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Owner can view audit logs"
  ON public.admin_audit_logs
  FOR SELECT TO authenticated
  USING (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can view cron run logs" ON public.cron_run_logs;
CREATE POLICY "Owner can view cron run logs"
  ON public.cron_run_logs
  FOR SELECT TO authenticated
  USING (public.is_owner_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.rate_limit_ok(
  p_rate_key text,
  p_action text,
  p_limit integer,
  p_window interval
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_key text := lower(left(coalesce(p_rate_key, 'anonymous'), 200));
BEGIN
  DELETE FROM public.rate_limit_events WHERE created_at < now() - interval '7 days';

  SELECT count(*) INTO v_count
  FROM public.rate_limit_events
  WHERE rate_key = v_key
    AND action = p_action
    AND created_at >= now() - p_window;

  IF v_count >= p_limit THEN
    RETURN false;
  END IF;

  INSERT INTO public.rate_limit_events(rate_key, action)
  VALUES (v_key, p_action);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_system_error(
  p_source text,
  p_severity text,
  p_message text,
  p_stack text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_request_path text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_rate_key text := coalesce(p_user_id::text, p_request_path, 'anonymous');
BEGIN
  IF NOT public.rate_limit_ok(v_rate_key, 'system_error', 20, interval '1 hour') THEN
    RAISE EXCEPTION 'Rate limit exceeded';
  END IF;

  INSERT INTO public.system_error_logs(source, severity, message, stack, user_id, request_path, metadata)
  VALUES (
    left(coalesce(p_source, 'client'), 80),
    CASE WHEN p_severity IN ('debug','info','warning','error','critical') THEN p_severity ELSE 'error' END,
    left(coalesce(p_message, 'Unknown error'), 2000),
    left(p_stack, 6000),
    p_user_id,
    left(p_request_path, 500),
    coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_admin_table_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := public.is_owner_admin(auth.uid());
  v_id text;
BEGIN
  IF NOT v_is_admin THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_id := COALESCE((to_jsonb(NEW)->>'id'), (to_jsonb(OLD)->>'id'), (to_jsonb(NEW)->>'key'), (to_jsonb(OLD)->>'key'));
  INSERT INTO public.admin_audit_logs(actor_id, actor_email, action, entity_type, entity_id, summary, metadata)
  VALUES (
    auth.uid(),
    'superbcreations55@gmail.com',
    lower(TG_OP),
    TG_TABLE_NAME,
    v_id,
    TG_TABLE_NAME || ' ' || lower(TG_OP),
    jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_products_changes ON public.products;
CREATE TRIGGER audit_products_changes AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_table_changes();

DROP TRIGGER IF EXISTS audit_orders_changes ON public.orders;
CREATE TRIGGER audit_orders_changes AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_table_changes();

DROP TRIGGER IF EXISTS audit_business_settings_changes ON public.business_settings;
CREATE TRIGGER audit_business_settings_changes AFTER INSERT OR UPDATE OR DELETE ON public.business_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_table_changes();

DROP TRIGGER IF EXISTS audit_payment_methods_changes ON public.payment_methods;
CREATE TRIGGER audit_payment_methods_changes AFTER INSERT OR UPDATE OR DELETE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_table_changes();

DROP TRIGGER IF EXISTS audit_coupons_changes ON public.coupons;
CREATE TRIGGER audit_coupons_changes AFTER INSERT OR UPDATE OR DELETE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_table_changes();

DROP TRIGGER IF EXISTS audit_blog_posts_changes ON public.blog_posts;
CREATE TRIGGER audit_blog_posts_changes AFTER INSERT OR UPDATE OR DELETE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_table_changes();

DROP TRIGGER IF EXISTS audit_marketing_popups_changes ON public.marketing_popups;
CREATE TRIGGER audit_marketing_popups_changes AFTER INSERT OR UPDATE OR DELETE ON public.marketing_popups
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_table_changes();

DROP TRIGGER IF EXISTS audit_media_library_changes ON public.media_library;
CREATE TRIGGER audit_media_library_changes AFTER INSERT OR UPDATE OR DELETE ON public.media_library
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_table_changes();

DROP POLICY IF EXISTS "Public can insert safe analytics events" ON public.analytics_events;
CREATE POLICY "Public can insert safe analytics events"
  ON public.analytics_events
  FOR INSERT
  WITH CHECK (
    event_type IN (
      'page_view','product_view','add_to_cart','remove_from_cart','wishlist_add','wishlist_remove',
      'checkout_started','coupon_applied','payment_started','payment_submitted','order_placed',
      'search_query','filter_usage','newsletter_signup','review_submitted'
    )
    AND jsonb_typeof(metadata) = 'object'
    AND octet_length(metadata::text) <= 4000
    AND public.rate_limit_ok(coalesce(session_id, user_id::text, path, 'anonymous'), 'analytics_event', 180, interval '1 hour')
  );

DROP POLICY IF EXISTS "Public can record popup events" ON public.marketing_popup_events;
CREATE POLICY "Public can record popup events"
  ON public.marketing_popup_events
  FOR INSERT
  WITH CHECK (
    event_type IN ('impression','click','dismiss')
    AND public.rate_limit_ok(coalesce(session_id, user_id::text, path, popup_id::text, 'anonymous'), 'popup_event', 120, interval '1 hour')
  );

DROP POLICY IF EXISTS "Anyone can subscribe newsletter" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can subscribe newsletter"
  ON public.newsletter_subscribers
  FOR INSERT
  WITH CHECK (
    email = lower(email)
    AND public.rate_limit_ok(lower(email), 'newsletter_signup', 5, interval '1 hour')
  );

DROP POLICY IF EXISTS "Anyone can resubscribe newsletter safely" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can resubscribe newsletter safely"
  ON public.newsletter_subscribers
  FOR UPDATE
  USING (email = lower(email))
  WITH CHECK (
    email = lower(email)
    AND subscribed = true
    AND public.rate_limit_ok(lower(email), 'newsletter_signup', 5, interval '1 hour')
  );

CREATE OR REPLACE FUNCTION public.generate_daily_analytics_snapshot(p_snapshot_date date DEFAULT current_date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metrics jsonb;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' AND NOT public.is_owner_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Owner admin access required';
  END IF;

  v_metrics := public.get_admin_analytics_summary(p_snapshot_date, p_snapshot_date)
    || jsonb_build_object('revenue', public.get_revenue_series(p_snapshot_date, p_snapshot_date));

  INSERT INTO public.daily_analytics_snapshots (snapshot_date, metrics, updated_at)
  VALUES (p_snapshot_date, v_metrics, now())
  ON CONFLICT (snapshot_date) DO UPDATE
    SET metrics = EXCLUDED.metrics,
        updated_at = now();

  RETURN v_metrics;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rate_limit_ok(text, text, integer, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_ok(text, text, integer, interval) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.record_system_error(text, text, text, text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_system_error(text, text, text, text, uuid, text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_daily_analytics_snapshot(date) TO authenticated, service_role;
