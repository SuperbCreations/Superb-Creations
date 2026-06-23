INSERT INTO public.business_settings (key, value)
VALUES
  ('default_shipping_provider', 'manual'),
  ('shipping_mode', 'manual'),
  ('enable_shiprocket', 'false'),
  ('enable_delhivery', 'false'),
  ('enable_india_post', 'false'),
  ('enable_blue_dart', 'false'),
  ('express_shipping_fee', '199'),
  ('shipping_insurance', 'false'),
  ('estimated_delivery_days', '3-7'),
  ('pickup_address', ''),
  ('return_address', ''),
  ('shipping_support_contact', 'superbcreations55@gmail.com'),
  ('shiprocket_api_key', ''),
  ('delhivery_api_key', ''),
  ('blue_dart_api_key', ''),
  ('india_post_customer_id', '')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "Public can view business settings" ON public.business_settings;
CREATE POLICY "Public can view business settings"
  ON public.business_settings
  FOR SELECT
  USING (key NOT IN ('brevo_api_key', 'shiprocket_api_key', 'delhivery_api_key', 'blue_dart_api_key'));

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS weight_grams integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS length_cm numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS width_cm numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS height_cm numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fragile boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS special_packaging boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_class text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS free_shipping_eligible boolean NOT NULL DEFAULT true;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS shipping_provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS shipping_mode text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS shipping_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packaging_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipment_label_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS customer_notes text,
  ADD COLUMN IF NOT EXISTS priority boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fragile boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.shipping_providers (
  key text PRIMARY KEY,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'manual',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shipping_methods (
  key text PRIMARY KEY,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  base_fee numeric NOT NULL DEFAULT 0,
  express_fee numeric NOT NULL DEFAULT 0,
  estimated_days text NOT NULL DEFAULT '3-7',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shipping_rate_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  min_subtotal numeric NOT NULL DEFAULT 0,
  max_subtotal numeric,
  pincode_prefix text,
  shipping_class text NOT NULL DEFAULT 'standard',
  fee numeric NOT NULL DEFAULT 0,
  express_fee numeric,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shipment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  courier_name text,
  tracking_number text,
  tracking_url text,
  notes text,
  visible_to_customer boolean NOT NULL DEFAULT true,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_rate_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS orders_tracking_number_idx ON public.orders(tracking_number);
CREATE INDEX IF NOT EXISTS orders_courier_name_idx ON public.orders(courier_name);
CREATE INDEX IF NOT EXISTS orders_shipping_status_idx ON public.orders(shipping_status);
CREATE INDEX IF NOT EXISTS shipment_events_order_created_idx ON public.shipment_events(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shipment_events_status_idx ON public.shipment_events(status, created_at DESC);
CREATE INDEX IF NOT EXISTS shipping_rate_rules_active_idx ON public.shipping_rate_rules(active, shipping_class);

GRANT SELECT ON public.shipping_providers, public.shipping_methods, public.shipping_rate_rules TO anon, authenticated;
GRANT SELECT ON public.shipment_events TO authenticated;
GRANT ALL ON public.shipping_providers, public.shipping_methods, public.shipping_rate_rules, public.shipment_events TO service_role;

DROP POLICY IF EXISTS "Public can view enabled shipping providers" ON public.shipping_providers;
CREATE POLICY "Public can view enabled shipping providers" ON public.shipping_providers FOR SELECT USING (enabled = true OR public.is_owner_admin(auth.uid()));
DROP POLICY IF EXISTS "Owner can manage shipping providers" ON public.shipping_providers;
CREATE POLICY "Owner can manage shipping providers" ON public.shipping_providers FOR ALL TO authenticated USING (public.is_owner_admin(auth.uid())) WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Public can view enabled shipping methods" ON public.shipping_methods;
CREATE POLICY "Public can view enabled shipping methods" ON public.shipping_methods FOR SELECT USING (enabled = true OR public.is_owner_admin(auth.uid()));
DROP POLICY IF EXISTS "Owner can manage shipping methods" ON public.shipping_methods;
CREATE POLICY "Owner can manage shipping methods" ON public.shipping_methods FOR ALL TO authenticated USING (public.is_owner_admin(auth.uid())) WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can manage shipping rules" ON public.shipping_rate_rules;
CREATE POLICY "Owner can manage shipping rules" ON public.shipping_rate_rules FOR ALL TO authenticated USING (public.is_owner_admin(auth.uid())) WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Customers can read own shipment events" ON public.shipment_events;
CREATE POLICY "Customers can read own shipment events" ON public.shipment_events FOR SELECT TO authenticated
  USING (
    public.is_owner_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = shipment_events.order_id AND o.user_id = auth.uid())
  );

INSERT INTO public.shipping_providers (key, name, enabled, mode)
VALUES
  ('manual', 'Manual Shipping', true, 'manual'),
  ('shiprocket', 'Shiprocket', false, 'api'),
  ('delhivery', 'Delhivery', false, 'api'),
  ('india_post', 'India Post', false, 'api'),
  ('blue_dart', 'Blue Dart', false, 'api')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.shipping_methods (key, name, enabled, base_fee, express_fee, estimated_days)
VALUES
  ('standard', 'Standard Shipping', true, 99, 0, '3-7'),
  ('express', 'Express Shipping', true, 99, 199, '1-3')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.email_templates (key, name, subject, body_html, body_text, category, variables)
VALUES
  ('order_ready_to_ship', 'Order Ready To Ship', 'Your order is ready to ship — {{order_number}}', '<p>Your order {{order_number}} is packed and ready to ship.</p>', 'Order ready to ship.', 'transactional', '["order_number"]'::jsonb),
  ('order_out_for_delivery', 'Out For Delivery', 'Out for delivery — {{order_number}}', '<p>Your order {{order_number}} is out for delivery today. {{tracking_info}}</p>', 'Order out for delivery.', 'transactional', '["order_number","tracking_info"]'::jsonb),
  ('order_delivery_failed', 'Delivery Failed', 'Delivery needs attention — {{order_number}}', '<p>Delivery for {{order_number}} could not be completed. Please contact support if you need help.</p>', 'Delivery failed.', 'transactional', '["order_number"]'::jsonb),
  ('order_returned_to_origin', 'Returned To Origin', 'Returned to origin — {{order_number}}', '<p>Your order {{order_number}} is being returned to origin. We will contact you with next steps.</p>', 'Returned to origin.', 'transactional', '["order_number"]'::jsonb)
ON CONFLICT (key) DO NOTHING;
