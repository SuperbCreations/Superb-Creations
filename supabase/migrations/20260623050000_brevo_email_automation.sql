INSERT INTO public.business_settings (key, value)
VALUES
  ('enable_email_sending', 'false'),
  ('brevo_api_key', ''),
  ('support_email', 'superbcreations55@gmail.com'),
  ('business_email', 'superbcreations55@gmail.com'),
  ('brevo_contacts_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex');

DROP POLICY IF EXISTS "Public can view business settings" ON public.business_settings;
CREATE POLICY "Public can view business settings"
  ON public.business_settings
  FOR SELECT
  TO anon, authenticated
  USING (
    public.is_owner_admin(auth.uid())
    OR key !~* '(api_key|secret|token|password|service_role|private)'
  );

CREATE TABLE IF NOT EXISTS public.email_templates (
  key text PRIMARY KEY,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'transactional',
  active boolean NOT NULL DEFAULT true,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  order_emails boolean NOT NULL DEFAULT true,
  marketing_emails boolean NOT NULL DEFAULT false,
  newsletter boolean NOT NULL DEFAULT false,
  offers boolean NOT NULL DEFAULT false,
  review_requests boolean NOT NULL DEFAULT true,
  product_updates boolean NOT NULL DEFAULT false,
  security_emails boolean NOT NULL DEFAULT true,
  unsubscribed_at timestamptz,
  unsubscribe_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  template_key text,
  campaign_id uuid,
  subject text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'queued',
  provider text NOT NULL DEFAULT 'brevo',
  provider_message_id text,
  error text,
  opened_at timestamptz,
  clicked_at timestamptz,
  delivered_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  template_key text NOT NULL,
  subject text NOT NULL DEFAULT '',
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text UNIQUE,
  last_error text,
  email_log_id uuid REFERENCES public.email_logs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.newsletter_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL DEFAULT '',
  audience text NOT NULL DEFAULT 'newsletter',
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.newsletter_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.newsletter_campaigns(id) ON DELETE CASCADE,
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued',
  email_log_id uuid REFERENCES public.email_logs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, email)
);

CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_log_id uuid REFERENCES public.email_logs(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'brevo',
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brevo_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  brevo_id text,
  list_name text,
  status text NOT NULL DEFAULT 'pending',
  last_error text,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, list_name)
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brevo_sync ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS email_logs_created_idx ON public.email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS email_logs_status_idx ON public.email_logs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS email_logs_recipient_idx ON public.email_logs(lower(recipient));
CREATE INDEX IF NOT EXISTS email_queue_status_next_idx ON public.email_queue(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS newsletter_campaigns_status_idx ON public.newsletter_campaigns(status, scheduled_at);
CREATE INDEX IF NOT EXISTS newsletter_campaign_recipients_campaign_idx ON public.newsletter_campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS email_events_log_idx ON public.email_events(email_log_id, created_at DESC);
CREATE INDEX IF NOT EXISTS brevo_sync_entity_idx ON public.brevo_sync(entity_type, entity_id);

DROP TRIGGER IF EXISTS trg_email_templates_updated ON public.email_templates;
CREATE TRIGGER trg_email_templates_updated BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_email_logs_updated ON public.email_logs;
CREATE TRIGGER trg_email_logs_updated BEFORE UPDATE ON public.email_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_email_queue_updated ON public.email_queue;
CREATE TRIGGER trg_email_queue_updated BEFORE UPDATE ON public.email_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_newsletter_campaigns_updated ON public.newsletter_campaigns;
CREATE TRIGGER trg_newsletter_campaigns_updated BEFORE UPDATE ON public.newsletter_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_brevo_sync_updated ON public.brevo_sync;
CREATE TRIGGER trg_brevo_sync_updated BEFORE UPDATE ON public.brevo_sync FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT ON public.email_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.email_preferences TO authenticated;
GRANT SELECT ON public.email_logs TO authenticated;
GRANT SELECT ON public.newsletter_campaigns TO authenticated;
GRANT SELECT ON public.newsletter_campaign_recipients TO authenticated;
GRANT SELECT ON public.email_events TO authenticated;
GRANT SELECT ON public.brevo_sync TO authenticated;
GRANT ALL ON public.email_templates, public.email_preferences, public.email_logs, public.email_queue, public.newsletter_campaigns, public.newsletter_campaign_recipients, public.email_events, public.brevo_sync TO service_role;

DROP POLICY IF EXISTS "Owner can manage email templates" ON public.email_templates;
CREATE POLICY "Owner can manage email templates" ON public.email_templates FOR ALL TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Customers can manage own email preferences" ON public.email_preferences;
CREATE POLICY "Customers can manage own email preferences" ON public.email_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_owner_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can view email logs" ON public.email_logs;
CREATE POLICY "Owner can view email logs" ON public.email_logs FOR SELECT TO authenticated
  USING (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can manage email queue" ON public.email_queue;
CREATE POLICY "Owner can manage email queue" ON public.email_queue FOR ALL TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can manage newsletter campaigns" ON public.newsletter_campaigns;
CREATE POLICY "Owner can manage newsletter campaigns" ON public.newsletter_campaigns FOR ALL TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can manage campaign recipients" ON public.newsletter_campaign_recipients;
CREATE POLICY "Owner can manage campaign recipients" ON public.newsletter_campaign_recipients FOR ALL TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can view email events" ON public.email_events;
CREATE POLICY "Owner can view email events" ON public.email_events FOR SELECT TO authenticated
  USING (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can view brevo sync" ON public.brevo_sync;
CREATE POLICY "Owner can view brevo sync" ON public.brevo_sync FOR SELECT TO authenticated
  USING (public.is_owner_admin(auth.uid()));

INSERT INTO public.email_templates (key, name, subject, body_html, body_text, category, variables)
VALUES
  ('welcome', 'Welcome', 'Welcome to {{store_name}}', '<p>Hi {{customer_name}}, welcome to {{store_name}}.</p>', 'Welcome to {{store_name}}.', 'account', '["customer_name","store_name"]'::jsonb),
  ('order_confirmed', 'Order Confirmed', 'Order confirmed — {{store_name}}', '<p>Hi {{customer_name}}, we received order {{order_number}} for {{total}}.</p>{{items_html}}', 'Your order {{order_number}} is confirmed.', 'transactional', '["customer_name","order_number","total","items_html"]'::jsonb),
  ('payment_submitted', 'Payment Submitted', 'Payment received for review — {{order_number}}', '<p>We received your UPI reference {{payment_utr}} for {{order_number}}.</p>', 'Payment submitted for {{order_number}}.', 'transactional', '["order_number","payment_utr"]'::jsonb),
  ('payment_approved', 'Payment Approved', 'Payment approved — {{order_number}}', '<p>Your payment is approved. We are preparing {{order_number}}.</p>', 'Payment approved for {{order_number}}.', 'transactional', '["order_number"]'::jsonb),
  ('payment_rejected', 'Payment Rejected', 'Payment needs attention — {{order_number}}', '<p>Your payment could not be verified. Reason: {{reason}}</p>', 'Payment rejected for {{order_number}}.', 'transactional', '["order_number","reason"]'::jsonb),
  ('order_packed', 'Order Packed', 'Your order is packed — {{order_number}}', '<p>Your order {{order_number}} is packed.</p>', 'Order packed.', 'transactional', '["order_number"]'::jsonb),
  ('order_shipped', 'Order Shipped', 'Your order has shipped — {{order_number}}', '<p>Your order {{order_number}} has shipped. {{tracking_info}}</p>', 'Order shipped.', 'transactional', '["order_number","tracking_info"]'::jsonb),
  ('order_delivered', 'Order Delivered', 'Delivered — {{order_number}}', '<p>Your order {{order_number}} has been delivered.</p>', 'Order delivered.', 'transactional', '["order_number"]'::jsonb),
  ('order_cancelled', 'Order Cancelled', 'Order cancelled — {{order_number}}', '<p>Your order {{order_number}} was cancelled.</p>', 'Order cancelled.', 'transactional', '["order_number"]'::jsonb),
  ('refund_initiated', 'Refund Initiated', 'Refund initiated — {{order_number}}', '<p>Your refund for {{order_number}} has been initiated.</p>', 'Refund initiated.', 'transactional', '["order_number"]'::jsonb),
  ('refund_completed', 'Refund Completed', 'Refund completed — {{order_number}}', '<p>Your refund for {{order_number}} is complete.</p>', 'Refund completed.', 'transactional', '["order_number"]'::jsonb),
  ('password_reset', 'Password Reset', 'Reset your {{store_name}} password', '<p>Use the secure link to reset your password.</p>', 'Reset your password.', 'security', '["store_name"]'::jsonb),
  ('email_verification', 'Email Verification', 'Verify your email for {{store_name}}', '<p>Please verify your email address.</p>', 'Verify your email.', 'security', '["store_name"]'::jsonb),
  ('newsletter', 'Newsletter', '{{campaign_subject}}', '{{campaign_body}}', '{{campaign_subject}}', 'marketing', '["campaign_subject","campaign_body"]'::jsonb),
  ('review_request', 'Review Request', 'How was your order?', '<p>We would love your review for {{product_name}}.</p>', 'Please review {{product_name}}.', 'marketing', '["product_name"]'::jsonb),
  ('coupon', 'Coupon', 'A special offer from {{store_name}}', '<p>Use coupon {{coupon_code}} before {{expires_at}}.</p>', 'Use coupon {{coupon_code}}.', 'marketing', '["coupon_code","expires_at"]'::jsonb),
  ('wishlist_back_in_stock', 'Wishlist Back In Stock', '{{product_name}} is back in stock', '<p>{{product_name}} from your wishlist is back.</p>', '{{product_name}} is back in stock.', 'marketing', '["product_name"]'::jsonb),
  ('wishlist_price_drop', 'Wishlist Price Drop', 'Price drop: {{product_name}}', '<p>{{product_name}} is now {{price}}.</p>', 'Wishlist price drop.', 'marketing', '["product_name","price"]'::jsonb),
  ('gift_card', 'Gift Card', 'Your {{store_name}} gift card', '<p>Your gift card {{gift_card_code}} has balance {{balance}}.</p>', 'Gift card {{gift_card_code}}.', 'transactional', '["gift_card_code","balance"]'::jsonb),
  ('loyalty_reward', 'Loyalty Reward', 'You earned loyalty points', '<p>You earned {{points}} points.</p>', 'You earned {{points}} points.', 'marketing', '["points"]'::jsonb),
  ('announcement', 'Announcement', '{{announcement_title}}', '<p>{{announcement_body}}</p>', '{{announcement_title}}', 'marketing', '["announcement_title","announcement_body"]'::jsonb)
ON CONFLICT (key) DO NOTHING;
