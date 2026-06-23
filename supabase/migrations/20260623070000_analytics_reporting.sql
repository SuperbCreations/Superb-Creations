CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  path text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_analytics_snapshots (
  snapshot_date date PRIMARY KEY,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_analytics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date, product_id)
);

CREATE TABLE IF NOT EXISTS public.customer_analytics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date, user_id)
);

CREATE TABLE IF NOT EXISTS public.analytics_export_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_type text NOT NULL,
  date_from date,
  date_to date,
  row_count integer NOT NULL DEFAULT 0,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_export_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS analytics_events_type_created_idx ON public.analytics_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_product_created_idx ON public.analytics_events(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_user_created_idx ON public.analytics_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_session_created_idx ON public.analytics_events(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_created_payment_idx ON public.orders(created_at DESC, payment_status, status);
CREATE INDEX IF NOT EXISTS orders_user_created_idx ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_payment_method_idx ON public.orders(payment_method, created_at DESC);
CREATE INDEX IF NOT EXISTS products_stock_status_idx ON public.products(active, in_stock, stock);
CREATE INDEX IF NOT EXISTS reviews_status_rating_idx ON public.reviews(status, approved, rating);
CREATE INDEX IF NOT EXISTS analytics_export_logs_actor_created_idx ON public.analytics_export_logs(actor_id, created_at DESC);

GRANT INSERT ON public.analytics_events TO anon, authenticated;
GRANT SELECT ON public.analytics_events TO authenticated;
GRANT SELECT ON public.daily_analytics_snapshots, public.product_analytics_snapshots, public.customer_analytics_snapshots, public.analytics_export_logs TO authenticated;
GRANT ALL ON public.analytics_events, public.daily_analytics_snapshots, public.product_analytics_snapshots, public.customer_analytics_snapshots, public.analytics_export_logs TO service_role;

DROP POLICY IF EXISTS "Public can insert safe analytics events" ON public.analytics_events;
CREATE POLICY "Public can insert safe analytics events"
  ON public.analytics_events
  FOR INSERT
  WITH CHECK (
    event_type IN (
      'page_view',
      'product_view',
      'add_to_cart',
      'remove_from_cart',
      'wishlist_add',
      'wishlist_remove',
      'checkout_started',
      'coupon_applied',
      'payment_started',
      'payment_submitted',
      'order_placed',
      'search_query',
      'filter_usage',
      'newsletter_signup',
      'review_submitted'
    )
    AND jsonb_typeof(metadata) = 'object'
    AND octet_length(metadata::text) <= 4000
  );

DROP POLICY IF EXISTS "Owner can read analytics events" ON public.analytics_events;
CREATE POLICY "Owner can read analytics events"
  ON public.analytics_events
  FOR SELECT TO authenticated
  USING (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can read daily analytics snapshots" ON public.daily_analytics_snapshots;
CREATE POLICY "Owner can read daily analytics snapshots"
  ON public.daily_analytics_snapshots
  FOR SELECT TO authenticated
  USING (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can read product analytics snapshots" ON public.product_analytics_snapshots;
CREATE POLICY "Owner can read product analytics snapshots"
  ON public.product_analytics_snapshots
  FOR SELECT TO authenticated
  USING (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can read customer analytics snapshots" ON public.customer_analytics_snapshots;
CREATE POLICY "Owner can read customer analytics snapshots"
  ON public.customer_analytics_snapshots
  FOR SELECT TO authenticated
  USING (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can manage analytics export logs" ON public.analytics_export_logs;
CREATE POLICY "Owner can manage analytics export logs"
  ON public.analytics_export_logs
  FOR ALL TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.analytics_assert_owner()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Owner admin access required';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.analytics_paid_order_filter(p_payment_status text, p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(p_payment_status, '') IN ('approved', 'paid', 'manual_confirmed')
    OR coalesce(p_status, '') IN ('confirmed', 'completed', 'delivered')
$$;

CREATE OR REPLACE FUNCTION public.get_admin_analytics_summary(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := p_from::timestamptz;
  v_end timestamptz := (p_to + 1)::timestamptz;
  v_today date := current_date;
  v_result jsonb;
BEGIN
  PERFORM public.analytics_assert_owner();

  WITH range_orders AS (
    SELECT * FROM public.orders WHERE created_at >= v_start AND created_at < v_end
  ),
  paid_orders AS (
    SELECT * FROM range_orders WHERE public.analytics_paid_order_filter(payment_status, status)
  ),
  lifetime_paid AS (
    SELECT * FROM public.orders WHERE public.analytics_paid_order_filter(payment_status, status)
  ),
  week_paid AS (
    SELECT * FROM public.orders WHERE public.analytics_paid_order_filter(payment_status, status) AND created_at >= date_trunc('week', now())
  ),
  month_paid AS (
    SELECT * FROM public.orders WHERE public.analytics_paid_order_filter(payment_status, status) AND created_at >= date_trunc('month', now())
  )
  SELECT jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to),
    'revenueToday', coalesce((SELECT sum(total) FROM public.orders WHERE public.analytics_paid_order_filter(payment_status, status) AND created_at >= v_today::timestamptz AND created_at < (v_today + 1)::timestamptz), 0),
    'revenueWeek', coalesce((SELECT sum(total) FROM week_paid), 0),
    'revenueMonth', coalesce((SELECT sum(total) FROM month_paid), 0),
    'revenueLifetime', coalesce((SELECT sum(total) FROM lifetime_paid), 0),
    'revenueRange', coalesce((SELECT sum(total) FROM paid_orders), 0),
    'ordersToday', (SELECT count(*) FROM public.orders WHERE created_at >= v_today::timestamptz AND created_at < (v_today + 1)::timestamptz),
    'ordersRange', (SELECT count(*) FROM range_orders),
    'ordersPending', (SELECT count(*) FROM range_orders WHERE coalesce(operational_status, status) IN ('new','processing','payment_under_review') OR payment_status IN ('awaiting_payment','under_review','pending')),
    'ordersCompleted', (SELECT count(*) FROM range_orders WHERE coalesce(operational_status, status) IN ('completed','delivered') OR status IN ('completed','delivered')),
    'ordersCancelled', (SELECT count(*) FROM range_orders WHERE coalesce(operational_status, status) = 'cancelled' OR status = 'cancelled'),
    'averageOrderValue', coalesce((SELECT round(avg(total)::numeric, 2) FROM paid_orders), 0),
    'pendingUpiPayments', (SELECT count(*) FROM range_orders WHERE payment_method = 'upi' AND payment_status IN ('awaiting_payment','under_review')),
    'pendingShipping', (SELECT count(*) FROM range_orders WHERE coalesce(shipping_status, 'not_shipped') IN ('not_shipped','packing','ready_to_ship','pickup_scheduled','picked_up','in_transit','out_for_delivery')),
    'lowStockCount', (SELECT count(*) FROM public.products WHERE active = true AND stock <= low_stock_threshold),
    'newCustomers', (SELECT count(*) FROM public.customer_profiles WHERE created_at >= v_start AND created_at < v_end),
    'repeatCustomers', (SELECT count(*) FROM (SELECT user_id FROM public.orders WHERE user_id IS NOT NULL AND public.analytics_paid_order_filter(payment_status, status) GROUP BY user_id HAVING count(*) > 1) r),
    'newsletterSubscribers', (SELECT count(*) FROM public.newsletter_subscribers WHERE subscribed = true),
    'reviewsPending', (SELECT count(*) FROM public.reviews WHERE approved = false OR status = 'pending'),
    'emailSentCount', (SELECT count(*) FROM public.email_logs WHERE status = 'sent' AND created_at >= v_start AND created_at < v_end),
    'conversionIndicators', jsonb_build_object(
      'pageViews', (SELECT count(*) FROM public.analytics_events WHERE event_type = 'page_view' AND created_at >= v_start AND created_at < v_end),
      'productViews', (SELECT count(*) FROM public.analytics_events WHERE event_type = 'product_view' AND created_at >= v_start AND created_at < v_end),
      'addToCart', (SELECT count(*) FROM public.analytics_events WHERE event_type = 'add_to_cart' AND created_at >= v_start AND created_at < v_end),
      'checkoutStarted', (SELECT count(*) FROM public.analytics_events WHERE event_type = 'checkout_started' AND created_at >= v_start AND created_at < v_end),
      'ordersPlaced', (SELECT count(*) FROM public.analytics_events WHERE event_type = 'order_placed' AND created_at >= v_start AND created_at < v_end)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_revenue_series(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := p_from::timestamptz;
  v_end timestamptz := (p_to + 1)::timestamptz;
BEGIN
  PERFORM public.analytics_assert_owner();
  RETURN (
    WITH days AS (
      SELECT generate_series(p_from, p_to, interval '1 day')::date AS day
    ),
    orders_by_day AS (
      SELECT created_at::date AS day,
        sum(CASE WHEN public.analytics_paid_order_filter(payment_status, status) THEN total ELSE 0 END) AS revenue,
        count(*) AS orders,
        avg(CASE WHEN public.analytics_paid_order_filter(payment_status, status) THEN total END) AS aov,
        count(*) FILTER (WHERE status = 'cancelled' OR operational_status = 'cancelled') AS cancelled,
        count(*) FILTER (WHERE refund_status IS NOT NULL AND refund_status <> '') AS refunds,
        sum(coalesce(discount_amount, 0)) AS discount_total,
        sum(coalesce(shipping_fee, 0)) AS shipping_revenue,
        sum(coalesce(packaging_fee, 0)) AS packaging_revenue
      FROM public.orders
      WHERE created_at >= v_start AND created_at < v_end
      GROUP BY created_at::date
    )
    SELECT jsonb_build_object(
      'series', coalesce(jsonb_agg(jsonb_build_object(
        'date', days.day,
        'revenue', coalesce(orders_by_day.revenue, 0),
        'orders', coalesce(orders_by_day.orders, 0),
        'averageOrderValue', coalesce(round(orders_by_day.aov::numeric, 2), 0),
        'cancelledOrders', coalesce(orders_by_day.cancelled, 0),
        'refunds', coalesce(orders_by_day.refunds, 0),
        'couponDiscountTotal', coalesce(orders_by_day.discount_total, 0),
        'shippingRevenue', coalesce(orders_by_day.shipping_revenue, 0),
        'packagingRevenue', coalesce(orders_by_day.packaging_revenue, 0)
      ) ORDER BY days.day), '[]'::jsonb),
      'paymentMethodSplit', coalesce((SELECT jsonb_agg(jsonb_build_object('method', payment_method, 'orders', count, 'revenue', revenue)) FROM (
        SELECT payment_method, count(*) AS count, sum(CASE WHEN public.analytics_paid_order_filter(payment_status, status) THEN total ELSE 0 END) AS revenue
        FROM public.orders
        WHERE created_at >= v_start AND created_at < v_end
        GROUP BY payment_method
      ) m), '[]'::jsonb)
    )
    FROM days
    LEFT JOIN orders_by_day ON orders_by_day.day = days.day
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_product_analytics(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := p_from::timestamptz;
  v_end timestamptz := (p_to + 1)::timestamptz;
BEGIN
  PERFORM public.analytics_assert_owner();
  RETURN (
    WITH item_sales AS (
      SELECT
        (item->>'product_id')::uuid AS product_id,
        max(item->>'name') AS item_name,
        sum((item->>'qty')::numeric) AS qty,
        sum((item->>'qty')::numeric * (item->>'price')::numeric) AS revenue,
        count(DISTINCT o.id) AS orders
      FROM public.orders o
      CROSS JOIN LATERAL jsonb_array_elements(o.items::jsonb) item
      WHERE o.created_at >= v_start AND o.created_at < v_end
        AND public.analytics_paid_order_filter(o.payment_status, o.status)
        AND item ? 'product_id'
      GROUP BY (item->>'product_id')::uuid
    ),
    views AS (
      SELECT product_id, count(*) AS views FROM public.analytics_events
      WHERE event_type = 'product_view' AND product_id IS NOT NULL AND created_at >= v_start AND created_at < v_end
      GROUP BY product_id
    ),
    wishes AS (
      SELECT product_id, count(*) AS wishlist_count FROM public.wishlist_items GROUP BY product_id
    ),
    ratings AS (
      SELECT product_id, avg(rating) AS avg_rating, count(*) AS review_count FROM public.reviews WHERE approved = true GROUP BY product_id
    ),
    returns AS (
      SELECT (item->>'product_id')::uuid AS product_id, count(*) AS returned_orders
      FROM public.orders o
      CROSS JOIN LATERAL jsonb_array_elements(o.items::jsonb) item
      WHERE o.created_at >= v_start AND o.created_at < v_end
        AND coalesce(o.operational_status, o.status) IN ('returned','returned_to_origin')
        AND item ? 'product_id'
      GROUP BY (item->>'product_id')::uuid
    )
    SELECT jsonb_build_object(
      'products', coalesce(jsonb_agg(jsonb_build_object(
        'productId', p.id,
        'name', p.name,
        'active', p.active,
        'stock', p.stock,
        'lowStockThreshold', p.low_stock_threshold,
        'inStock', p.in_stock,
        'soldQuantity', coalesce(s.qty, 0),
        'revenue', coalesce(s.revenue, 0),
        'orders', coalesce(s.orders, 0),
        'views', coalesce(v.views, 0),
        'wishlistCount', coalesce(w.wishlist_count, 0),
        'averageRating', coalesce(round(r.avg_rating::numeric, 2), 0),
        'reviewCount', coalesce(r.review_count, 0),
        'returnRate', CASE WHEN coalesce(s.orders, 0) = 0 THEN 0 ELSE round((coalesce(ret.returned_orders, 0)::numeric / s.orders::numeric) * 100, 2) END
      ) ORDER BY coalesce(s.revenue, 0) DESC), '[]'::jsonb),
      'lowStockProducts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'stock', stock, 'threshold', low_stock_threshold)) FROM public.products WHERE active = true AND stock <= low_stock_threshold), '[]'::jsonb),
      'outOfStockProducts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'stock', stock)) FROM public.products WHERE active = true AND (in_stock = false OR stock <= 0)), '[]'::jsonb)
    )
    FROM public.products p
    LEFT JOIN item_sales s ON s.product_id = p.id
    LEFT JOIN views v ON v.product_id = p.id
    LEFT JOIN wishes w ON w.product_id = p.id
    LEFT JOIN ratings r ON r.product_id = p.id
    LEFT JOIN returns ret ON ret.product_id = p.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_customer_analytics(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := p_from::timestamptz;
  v_end timestamptz := (p_to + 1)::timestamptz;
BEGIN
  PERFORM public.analytics_assert_owner();
  RETURN (
    WITH customer_orders AS (
      SELECT user_id, max(customer_name) AS customer_name, max(email) AS email, count(*) AS order_count, sum(total) AS revenue, max(created_at) AS last_order_at
      FROM public.orders
      WHERE user_id IS NOT NULL AND public.analytics_paid_order_filter(payment_status, status)
      GROUP BY user_id
    )
    SELECT jsonb_build_object(
      'totalCustomers', (SELECT count(*) FROM public.customer_profiles),
      'newCustomers', (SELECT count(*) FROM public.customer_profiles WHERE created_at >= v_start AND created_at < v_end),
      'repeatCustomers', (SELECT count(*) FROM customer_orders WHERE order_count > 1),
      'wishlistUsers', (SELECT count(DISTINCT user_id) FROM public.wishlists),
      'newsletterSubscribers', (SELECT count(*) FROM public.newsletter_subscribers WHERE subscribed = true),
      'inactiveCustomers', (SELECT count(*) FROM customer_orders WHERE last_order_at < now() - interval '90 days'),
      'abandonedCartIndicators', (SELECT count(DISTINCT session_id) FROM public.analytics_events WHERE event_type = 'checkout_started' AND created_at >= v_start AND created_at < v_end) - (SELECT count(*) FROM public.orders WHERE created_at >= v_start AND created_at < v_end),
      'topCustomersByRevenue', coalesce((SELECT jsonb_agg(jsonb_build_object('userId', user_id, 'name', customer_name, 'email', email, 'orders', order_count, 'revenue', revenue) ORDER BY revenue DESC) FROM (SELECT * FROM customer_orders ORDER BY revenue DESC LIMIT 20) t), '[]'::jsonb),
      'topCustomersByOrderCount', coalesce((SELECT jsonb_agg(jsonb_build_object('userId', user_id, 'name', customer_name, 'email', email, 'orders', order_count, 'revenue', revenue) ORDER BY order_count DESC) FROM (SELECT * FROM customer_orders ORDER BY order_count DESC LIMIT 20) t), '[]'::jsonb),
      'loyaltyLeaders', coalesce((SELECT jsonb_agg(jsonb_build_object('userId', user_id, 'points', points, 'lifetimePoints', lifetime_points) ORDER BY points DESC) FROM (SELECT * FROM public.loyalty_points ORDER BY points DESC LIMIT 20) l), '[]'::jsonb)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_inventory_analytics(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := p_from::timestamptz;
  v_end timestamptz := (p_to + 1)::timestamptz;
BEGIN
  PERFORM public.analytics_assert_owner();
  RETURN (
    SELECT jsonb_build_object(
      'availableStockValue', coalesce(sum(stock * price), 0),
      'reservedStockValue', coalesce(sum(reserved_stock * price), 0),
      'soldStockCount', coalesce(sum(sold_stock), 0),
      'damagedStockCount', coalesce(sum(damaged_stock), 0),
      'returnedStockCount', coalesce(sum(returned_stock), 0),
      'lowStockWarnings', count(*) FILTER (WHERE active = true AND stock <= low_stock_threshold),
      'productsNeedingRestock', coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'stock', stock, 'threshold', low_stock_threshold) ORDER BY stock) FILTER (WHERE active = true AND stock <= low_stock_threshold), '[]'::jsonb),
      'movementHistory', coalesce((SELECT jsonb_agg(jsonb_build_object('createdAt', created_at, 'productId', product_id, 'variantId', variant_id, 'type', movement_type, 'quantity', quantity, 'previousStock', previous_stock, 'newStock', new_stock, 'note', note) ORDER BY created_at DESC) FROM (SELECT * FROM public.inventory_events WHERE created_at >= v_start AND created_at < v_end ORDER BY created_at DESC LIMIT 100) m), '[]'::jsonb),
      'stockAdjustmentReport', coalesce((SELECT jsonb_agg(jsonb_build_object('type', movement_type, 'quantity', quantity)) FROM (SELECT movement_type, sum(quantity) AS quantity FROM public.inventory_events WHERE created_at >= v_start AND created_at < v_end GROUP BY movement_type) s), '[]'::jsonb)
    )
    FROM public.products
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_payment_analytics(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := p_from::timestamptz;
  v_end timestamptz := (p_to + 1)::timestamptz;
BEGIN
  PERFORM public.analytics_assert_owner();
  RETURN (
    SELECT jsonb_build_object(
      'upiPending', count(*) FILTER (WHERE payment_method = 'upi' AND payment_status = 'awaiting_payment'),
      'upiSubmitted', count(*) FILTER (WHERE payment_method = 'upi' AND payment_status = 'under_review'),
      'upiApproved', count(*) FILTER (WHERE payment_method = 'upi' AND payment_status IN ('approved','paid','manual_confirmed')),
      'upiRejected', count(*) FILTER (WHERE payment_method = 'upi' AND payment_status = 'rejected'),
      'expiredPayments', count(*) FILTER (WHERE payment_status = 'expired'),
      'duplicateUtrAttempts', coalesce((SELECT count(*) FROM (SELECT payment_utr FROM public.orders WHERE payment_utr IS NOT NULL AND payment_utr <> '' GROUP BY payment_utr HAVING count(*) > 1) d), 0),
      'paymentApprovalTimeMinutes', coalesce(round(avg(EXTRACT(epoch FROM (payment_verified_at - payment_submitted_at)) / 60)::numeric, 2), 0),
      'revenueByPaymentMethod', coalesce((SELECT jsonb_agg(jsonb_build_object('method', payment_method, 'revenue', revenue, 'orders', orders)) FROM (SELECT payment_method, sum(total) AS revenue, count(*) AS orders FROM public.orders WHERE created_at >= v_start AND created_at < v_end AND public.analytics_paid_order_filter(payment_status, status) GROUP BY payment_method) r), '[]'::jsonb),
      'razorpayPlaceholder', jsonb_build_object('enabled', false, 'message', 'Razorpay metrics reserved for future re-enable.')
    )
    FROM public.orders
    WHERE created_at >= v_start AND created_at < v_end
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_shipping_analytics(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := p_from::timestamptz;
  v_end timestamptz := (p_to + 1)::timestamptz;
BEGIN
  PERFORM public.analytics_assert_owner();
  RETURN (
    SELECT jsonb_build_object(
      'notShipped', count(*) FILTER (WHERE coalesce(shipping_status, 'not_shipped') = 'not_shipped'),
      'packedOrders', count(*) FILTER (WHERE shipping_status IN ('packing','packed','ready_to_ship')),
      'shippedOrders', count(*) FILTER (WHERE shipping_status IN ('picked_up','in_transit','shipped','out_for_delivery')),
      'deliveredOrders', count(*) FILTER (WHERE shipping_status = 'delivered'),
      'deliveryFailed', count(*) FILTER (WHERE shipping_status = 'delivery_failed'),
      'returnedToOrigin', count(*) FILTER (WHERE shipping_status = 'returned_to_origin'),
      'averageDispatchTimeHours', coalesce(round(avg(EXTRACT(epoch FROM (dispatch_date::timestamptz - created_at)) / 3600)::numeric, 2), 0),
      'averageDeliveryTimeHours', coalesce(round(avg(EXTRACT(epoch FROM (delivery_date::timestamptz - created_at)) / 3600)::numeric, 2), 0),
      'courierPerformance', coalesce((SELECT jsonb_agg(jsonb_build_object('courier', courier, 'orders', orders, 'delivered', delivered, 'failed', failed)) FROM (SELECT coalesce(courier_name, shipping_provider, 'Manual') AS courier, count(*) AS orders, count(*) FILTER (WHERE shipping_status = 'delivered') AS delivered, count(*) FILTER (WHERE shipping_status = 'delivery_failed') AS failed FROM public.orders WHERE created_at >= v_start AND created_at < v_end GROUP BY coalesce(courier_name, shipping_provider, 'Manual') ORDER BY orders DESC) c), '[]'::jsonb),
      'shippingFeeCollected', coalesce(sum(shipping_fee), 0),
      'packagingFeeCollected', coalesce(sum(packaging_fee), 0)
    )
    FROM public.orders
    WHERE created_at >= v_start AND created_at < v_end
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_email_analytics(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := p_from::timestamptz;
  v_end timestamptz := (p_to + 1)::timestamptz;
BEGIN
  PERFORM public.analytics_assert_owner();
  RETURN (
    SELECT jsonb_build_object(
      'sent', count(*) FILTER (WHERE status = 'sent'),
      'failed', count(*) FILTER (WHERE status = 'failed'),
      'queued', (SELECT count(*) FROM public.email_queue WHERE status = 'queued'),
      'delivered', count(*) FILTER (WHERE delivered_at IS NOT NULL),
      'opened', count(*) FILTER (WHERE opened_at IS NOT NULL),
      'clicked', count(*) FILTER (WHERE clicked_at IS NOT NULL),
      'bounced', count(*) FILTER (WHERE status = 'bounced'),
      'complaints', count(*) FILTER (WHERE status = 'complaint'),
      'templatePerformance', coalesce((SELECT jsonb_agg(jsonb_build_object('template', template_key, 'sent', sent, 'failed', failed, 'opened', opened, 'clicked', clicked)) FROM (SELECT coalesce(template_key, 'custom') AS template_key, count(*) FILTER (WHERE status = 'sent') AS sent, count(*) FILTER (WHERE status = 'failed') AS failed, count(*) FILTER (WHERE opened_at IS NOT NULL) AS opened, count(*) FILTER (WHERE clicked_at IS NOT NULL) AS clicked FROM public.email_logs WHERE created_at >= v_start AND created_at < v_end GROUP BY coalesce(template_key, 'custom') ORDER BY sent DESC) t), '[]'::jsonb),
      'campaignPerformance', coalesce((SELECT jsonb_agg(jsonb_build_object('name', name, 'status', status, 'sentAt', sent_at, 'recipientCount', recipient_count) ORDER BY created_at DESC) FROM (
        SELECT c.name, c.status, c.sent_at, c.created_at, coalesce(r.recipient_count, 0) AS recipient_count
        FROM public.newsletter_campaigns c
        LEFT JOIN LATERAL (SELECT count(*) AS recipient_count FROM public.newsletter_campaign_recipients ncr WHERE ncr.campaign_id = c.id) r ON true
        ORDER BY c.created_at DESC
        LIMIT 20
      ) campaigns), '[]'::jsonb)
    )
    FROM public.email_logs
    WHERE created_at >= v_start AND created_at < v_end
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_coupon_analytics(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := p_from::timestamptz;
  v_end timestamptz := (p_to + 1)::timestamptz;
BEGIN
  PERFORM public.analytics_assert_owner();
  RETURN (
    SELECT jsonb_build_object(
      'discountGiven', coalesce((SELECT sum(discount_amount) FROM public.coupon_redemptions WHERE created_at >= v_start AND created_at < v_end), 0),
      'couponRevenue', coalesce((SELECT sum(o.total) FROM public.coupon_redemptions cr JOIN public.orders o ON o.id = cr.order_id WHERE cr.created_at >= v_start AND cr.created_at < v_end AND public.analytics_paid_order_filter(o.payment_status, o.status)), 0),
      'mostUsedCoupons', coalesce((SELECT jsonb_agg(jsonb_build_object('code', code, 'uses', uses, 'discount', discount, 'revenue', revenue) ORDER BY uses DESC) FROM (
        SELECT c.code, r.uses, r.discount, rev.revenue
        FROM (SELECT coupon_id, count(*) AS uses, sum(discount_amount) AS discount FROM public.coupon_redemptions WHERE created_at >= v_start AND created_at < v_end GROUP BY coupon_id) r
        JOIN public.coupons c ON c.id = r.coupon_id
        LEFT JOIN LATERAL (SELECT sum(o.total) AS revenue FROM public.coupon_redemptions cr JOIN public.orders o ON o.id = cr.order_id WHERE cr.coupon_id = c.id AND public.analytics_paid_order_filter(o.payment_status, o.status)) rev ON true
      ) coupon_usage), '[]'::jsonb),
      'usageByCustomer', coalesce((SELECT jsonb_agg(jsonb_build_object('userId', user_id, 'uses', uses, 'discount', discount)) FROM (SELECT user_id, count(*) AS uses, sum(discount_amount) AS discount FROM public.coupon_redemptions WHERE user_id IS NOT NULL AND created_at >= v_start AND created_at < v_end GROUP BY user_id ORDER BY uses DESC LIMIT 20) u), '[]'::jsonb),
      'expiringCoupons', coalesce((SELECT jsonb_agg(jsonb_build_object('code', code, 'expiresAt', expires_at, 'active', active) ORDER BY expires_at) FROM public.coupons WHERE active = true AND expires_at IS NOT NULL AND expires_at <= now() + interval '14 days'), '[]'::jsonb),
      'conversionImpact', jsonb_build_object('ordersWithCoupon', (SELECT count(DISTINCT order_id) FROM public.coupon_redemptions WHERE created_at >= v_start AND created_at < v_end), 'totalOrders', (SELECT count(*) FROM public.orders WHERE created_at >= v_start AND created_at < v_end))
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_review_analytics(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := p_from::timestamptz;
  v_end timestamptz := (p_to + 1)::timestamptz;
BEGIN
  PERFORM public.analytics_assert_owner();
  RETURN (
    SELECT jsonb_build_object(
      'averageRating', coalesce(round(avg(rating)::numeric, 2), 0),
      'pendingReviews', count(*) FILTER (WHERE approved = false OR status = 'pending'),
      'approvedReviews', count(*) FILTER (WHERE approved = true OR status = 'approved'),
      'rejectedReviews', count(*) FILTER (WHERE status = 'rejected'),
      'featuredReviews', count(*) FILTER (WHERE featured = true),
      'mostReviewedProducts', coalesce((SELECT jsonb_agg(jsonb_build_object('productId', product_id, 'name', name, 'reviews', reviews, 'averageRating', average_rating)) FROM (SELECT r.product_id, max(p.name) AS name, count(*) AS reviews, round(avg(r.rating)::numeric, 2) AS average_rating FROM public.reviews r LEFT JOIN public.products p ON p.id = r.product_id GROUP BY r.product_id ORDER BY reviews DESC LIMIT 20) m), '[]'::jsonb),
      'reviewRequestPendingCount', (SELECT count(*) FROM public.orders WHERE public.analytics_paid_order_filter(payment_status, status) AND created_at < now() - interval '7 days')
    )
    FROM public.reviews
    WHERE created_at >= v_start AND created_at < v_end
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_daily_analytics_snapshot(p_snapshot_date date DEFAULT current_date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metrics jsonb;
BEGIN
  PERFORM public.analytics_assert_owner();
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

REVOKE EXECUTE ON FUNCTION public.analytics_assert_owner() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_analytics_summary(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_revenue_series(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_product_analytics(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_customer_analytics(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_inventory_analytics(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_payment_analytics(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_shipping_analytics(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_email_analytics(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_coupon_analytics(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_review_analytics(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_daily_analytics_snapshot(date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_admin_analytics_summary(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_revenue_series(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_product_analytics(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_customer_analytics(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_inventory_analytics(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_payment_analytics(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_shipping_analytics(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_email_analytics(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_coupon_analytics(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_review_analytics(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_daily_analytics_snapshot(date) TO authenticated, service_role;
