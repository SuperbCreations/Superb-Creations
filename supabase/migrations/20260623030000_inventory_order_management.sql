ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS reserved_stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sold_stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damaged_stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returned_stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_sales integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS product_status text NOT NULL DEFAULT 'active';

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS reserved_stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sold_stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damaged_stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returned_stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS operational_status text NOT NULL DEFAULT 'order_created',
  ADD COLUMN IF NOT EXISTS shipping_status text NOT NULL DEFAULT 'not_ready',
  ADD COLUMN IF NOT EXISTS courier_name text,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS estimated_delivery_date date,
  ADD COLUMN IF NOT EXISTS dispatch_date date,
  ADD COLUMN IF NOT EXISTS delivery_date date,
  ADD COLUMN IF NOT EXISTS shipping_notes text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_status text,
  ADD COLUMN IF NOT EXISTS refund_reason text;

UPDATE public.orders
SET order_number = 'SC-' || upper(substr(replace(id::text, '-', ''), 1, 10))
WHERE order_number IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN order_number SET DEFAULT ('SC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)));

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_unique
  ON public.orders (order_number);

CREATE INDEX IF NOT EXISTS orders_status_created_idx
  ON public.orders (status, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_operational_status_idx
  ON public.orders (operational_status, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_payment_status_idx
  ON public.orders (payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_customer_search_idx
  ON public.orders (lower(customer_name), lower(coalesce(email, '')), phone);

CREATE INDEX IF NOT EXISTS products_low_stock_idx
  ON public.products (active, stock, low_stock_threshold);

CREATE TABLE IF NOT EXISTS public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  label text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  visible_to_customer boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS order_events_order_created_idx
  ON public.order_events (order_id, created_at DESC);

GRANT SELECT ON public.order_events TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.order_events TO authenticated;
GRANT ALL ON public.order_events TO service_role;

DROP POLICY IF EXISTS "Owner can manage order events" ON public.order_events;
CREATE POLICY "Owner can manage order events"
  ON public.order_events
  FOR ALL
  TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Customers can view public order events" ON public.order_events;
CREATE POLICY "Customers can view public order events"
  ON public.order_events
  FOR SELECT
  TO authenticated
  USING (
    visible_to_customer = true
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_events.order_id
        AND o.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.inventory_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  movement_type text NOT NULL,
  quantity integer NOT NULL,
  previous_stock integer,
  new_stock integer,
  note text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS inventory_events_product_created_idx
  ON public.inventory_events (product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS inventory_events_order_idx
  ON public.inventory_events (order_id);

GRANT SELECT ON public.inventory_events TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.inventory_events TO authenticated;
GRANT ALL ON public.inventory_events TO service_role;

DROP POLICY IF EXISTS "Owner can manage inventory events" ON public.inventory_events;
CREATE POLICY "Owner can manage inventory events"
  ON public.inventory_events
  FOR ALL
  TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.append_order_event(
  p_order_id uuid,
  p_event_type text,
  p_label text,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_visible_to_customer boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO public.order_events (
    order_id,
    event_type,
    label,
    details,
    actor_id,
    visible_to_customer
  )
  VALUES (
    p_order_id,
    p_event_type,
    p_label,
    COALESCE(p_details, '{}'::jsonb),
    auth.uid(),
    p_visible_to_customer
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_inventory_event(
  p_product_id uuid,
  p_variant_id uuid,
  p_order_id uuid,
  p_movement_type text,
  p_quantity integer,
  p_previous_stock integer,
  p_new_stock integer,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO public.inventory_events (
    product_id,
    variant_id,
    order_id,
    movement_type,
    quantity,
    previous_stock,
    new_stock,
    note,
    actor_id
  )
  VALUES (
    p_product_id,
    p_variant_id,
    p_order_id,
    p_movement_type,
    p_quantity,
    p_previous_stock,
    p_new_stock,
    NULLIF(trim(COALESCE(p_note, '')), ''),
    auth.uid()
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_order_stock_locked(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_qty integer;
  v_updated integer;
  v_previous_stock integer;
  v_new_stock integer;
BEGIN
  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_order.stock_deducted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_deducted', true);
  END IF;

  FOR v_item IN SELECT jsonb_array_elements(v_order.items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;
    v_qty := COALESCE((v_item->>'qty')::integer, 0);

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity in order %', p_order_id;
    END IF;

    IF v_variant_id IS NOT NULL THEN
      SELECT stock INTO v_previous_stock
      FROM public.product_variants
      WHERE id = v_variant_id AND product_id = v_product_id
      FOR UPDATE;

      UPDATE public.product_variants
      SET
        stock = stock - v_qty,
        reserved_stock = reserved_stock + v_qty
      WHERE id = v_variant_id
        AND product_id = v_product_id
        AND stock >= v_qty
      RETURNING stock INTO v_new_stock;
    ELSE
      SELECT stock INTO v_previous_stock
      FROM public.products
      WHERE id = v_product_id
      FOR UPDATE;

      UPDATE public.products
      SET
        stock = stock - v_qty,
        reserved_stock = reserved_stock + v_qty
      WHERE id = v_product_id
        AND stock >= v_qty
      RETURNING stock INTO v_new_stock;
    END IF;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 1 THEN
      RAISE EXCEPTION 'Insufficient stock for item % in order %', v_item, p_order_id;
    END IF;

    PERFORM public.log_inventory_event(
      v_product_id,
      v_variant_id,
      p_order_id,
      'reserved',
      -v_qty,
      v_previous_stock,
      v_new_stock,
      'Reserved for order'
    );
  END LOOP;

  UPDATE public.orders
  SET stock_deducted_at = now()
  WHERE id = p_order_id;

  PERFORM public.append_order_event(
    p_order_id,
    'inventory_reserved',
    'Stock Reserved',
    '{}'::jsonb,
    false
  );

  RETURN jsonb_build_object('ok', true, 'already_deducted', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.move_reserved_stock_to_sold(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_qty integer;
BEGIN
  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_order.payment_verified_at IS NOT NULL AND v_order.payment_status IN ('approved', 'paid', 'manual_confirmed') THEN
    RETURN jsonb_build_object('ok', true, 'already_sold', true);
  END IF;

  FOR v_item IN SELECT jsonb_array_elements(v_order.items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;
    v_qty := COALESCE((v_item->>'qty')::integer, 0);

    IF v_variant_id IS NOT NULL THEN
      UPDATE public.product_variants
      SET
        reserved_stock = GREATEST(reserved_stock - v_qty, 0),
        sold_stock = sold_stock + v_qty
      WHERE id = v_variant_id
        AND product_id = v_product_id;
    ELSE
      UPDATE public.products
      SET
        reserved_stock = GREATEST(reserved_stock - v_qty, 0),
        sold_stock = sold_stock + v_qty,
        lifetime_sales = lifetime_sales + v_qty
      WHERE id = v_product_id;
    END IF;

    PERFORM public.log_inventory_event(
      v_product_id,
      v_variant_id,
      p_order_id,
      'sold',
      -v_qty,
      NULL,
      NULL,
      'Moved reserved stock to sold'
    );
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'already_sold', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_order_stock_locked(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_qty integer;
  v_previous_stock integer;
  v_new_stock integer;
BEGIN
  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_order.stock_deducted_at IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_released', true);
  END IF;

  IF v_order.status = 'confirmed' OR v_order.payment_status IN ('paid', 'approved', 'manual_confirmed') THEN
    RAISE EXCEPTION 'Cannot release stock for confirmed order %', p_order_id;
  END IF;

  FOR v_item IN SELECT jsonb_array_elements(v_order.items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;
    v_qty := COALESCE((v_item->>'qty')::integer, 0);

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity in order %', p_order_id;
    END IF;

    IF v_variant_id IS NOT NULL THEN
      SELECT stock INTO v_previous_stock
      FROM public.product_variants
      WHERE id = v_variant_id AND product_id = v_product_id
      FOR UPDATE;

      UPDATE public.product_variants
      SET
        stock = stock + v_qty,
        reserved_stock = GREATEST(reserved_stock - v_qty, 0)
      WHERE id = v_variant_id
        AND product_id = v_product_id
      RETURNING stock INTO v_new_stock;
    ELSE
      SELECT stock INTO v_previous_stock
      FROM public.products
      WHERE id = v_product_id
      FOR UPDATE;

      UPDATE public.products
      SET
        stock = stock + v_qty,
        reserved_stock = GREATEST(reserved_stock - v_qty, 0)
      WHERE id = v_product_id
      RETURNING stock INTO v_new_stock;
    END IF;

    PERFORM public.log_inventory_event(
      v_product_id,
      v_variant_id,
      p_order_id,
      'released',
      v_qty,
      v_previous_stock,
      v_new_stock,
      'Released reserved stock'
    );
  END LOOP;

  UPDATE public.orders
  SET stock_deducted_at = NULL
  WHERE id = p_order_id;

  PERFORM public.append_order_event(
    p_order_id,
    'inventory_released',
    'Stock Released',
    '{}'::jsonb,
    false
  );

  RETURN jsonb_build_object('ok', true, 'already_released', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_manual_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_stock jsonb;
  v_sold jsonb;
BEGIN
  IF NOT public.is_owner_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only owner admin can confirm manual orders';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_order.payment_method = 'razorpay' THEN
    RAISE EXCEPTION 'Use Razorpay verification for Razorpay orders';
  END IF;

  v_stock := public.apply_order_stock_locked(p_order_id);
  v_sold := public.move_reserved_stock_to_sold(p_order_id);

  UPDATE public.orders
  SET
    status = 'confirmed',
    operational_status = 'payment_approved',
    payment_status = CASE
      WHEN payment_status IN ('paid', 'approved') THEN payment_status
      WHEN payment_method = 'upi' THEN 'approved'
      ELSE 'manual_confirmed'
    END,
    payment_verified_at = COALESCE(payment_verified_at, now())
  WHERE id = p_order_id;

  PERFORM public.append_order_event(
    p_order_id,
    'payment_approved',
    'Payment Approved',
    '{}'::jsonb,
    true
  );

  RETURN jsonb_build_object('ok', true, 'stock', v_stock, 'sold', v_sold);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_razorpay_payment(
  p_order_id uuid,
  p_razorpay_payment_id text,
  p_razorpay_order_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_stock jsonb;
  v_sold jsonb;
BEGIN
  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true);
  END IF;

  IF v_order.payment_method <> 'razorpay' THEN
    RAISE EXCEPTION 'Order % is not a Razorpay order', p_order_id;
  END IF;

  v_stock := public.apply_order_stock_locked(p_order_id);
  v_sold := public.move_reserved_stock_to_sold(p_order_id);

  UPDATE public.orders
  SET
    payment_status = 'paid',
    status = 'confirmed',
    operational_status = 'payment_approved',
    razorpay_payment_id = p_razorpay_payment_id,
    razorpay_order_id = p_razorpay_order_id,
    payment_verified_at = COALESCE(payment_verified_at, now())
  WHERE id = p_order_id;

  PERFORM public.append_order_event(
    p_order_id,
    'payment_approved',
    'Payment Approved',
    jsonb_build_object('provider', 'razorpay'),
    true
  );

  RETURN jsonb_build_object('ok', true, 'already_paid', false, 'stock', v_stock, 'sold', v_sold);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_order_operations(
  p_order_id uuid,
  p_operational_status text DEFAULT NULL,
  p_shipping_status text DEFAULT NULL,
  p_courier_name text DEFAULT NULL,
  p_tracking_number text DEFAULT NULL,
  p_estimated_delivery_date date DEFAULT NULL,
  p_dispatch_date date DEFAULT NULL,
  p_delivery_date date DEFAULT NULL,
  p_shipping_notes text DEFAULT NULL,
  p_internal_notes text DEFAULT NULL,
  p_refund_status text DEFAULT NULL,
  p_refund_reason text DEFAULT NULL,
  p_event_label text DEFAULT NULL,
  p_visible_to_customer boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_status text;
BEGIN
  IF NOT public.is_owner_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only owner admin can update orders';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  v_status := COALESCE(p_operational_status, v_order.operational_status);

  UPDATE public.orders
  SET
    operational_status = v_status,
    status = CASE
      WHEN p_operational_status IN ('cancelled', 'returned', 'expired') THEN p_operational_status
      WHEN p_operational_status = 'delivered' THEN 'delivered'
      WHEN p_operational_status = 'completed' THEN 'completed'
      WHEN p_operational_status IS NOT NULL THEN p_operational_status
      ELSE status
    END,
    shipping_status = COALESCE(p_shipping_status, shipping_status),
    courier_name = COALESCE(NULLIF(trim(COALESCE(p_courier_name, '')), ''), courier_name),
    tracking_number = COALESCE(NULLIF(trim(COALESCE(p_tracking_number, '')), ''), tracking_number),
    estimated_delivery_date = COALESCE(p_estimated_delivery_date, estimated_delivery_date),
    dispatch_date = COALESCE(p_dispatch_date, dispatch_date),
    delivery_date = COALESCE(p_delivery_date, delivery_date),
    shipping_notes = COALESCE(p_shipping_notes, shipping_notes),
    internal_notes = COALESCE(p_internal_notes, internal_notes),
    refund_status = COALESCE(p_refund_status, refund_status),
    refund_reason = COALESCE(p_refund_reason, refund_reason),
    cancelled_at = CASE WHEN p_operational_status = 'cancelled' THEN now() ELSE cancelled_at END
  WHERE id = p_order_id;

  IF p_event_label IS NOT NULL OR p_operational_status IS NOT NULL THEN
    PERFORM public.append_order_event(
      p_order_id,
      COALESCE(p_operational_status, 'order_updated'),
      COALESCE(p_event_label, initcap(replace(v_status, '_', ' '))),
      jsonb_build_object(
        'operational_status', v_status,
        'shipping_status', COALESCE(p_shipping_status, v_order.shipping_status),
        'courier_name', p_courier_name,
        'tracking_number', p_tracking_number
      ),
      p_visible_to_customer
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(
  p_product_id uuid,
  p_variant_id uuid DEFAULT NULL,
  p_quantity integer DEFAULT 0,
  p_movement_type text DEFAULT 'adjustment',
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_stock integer;
  v_new_stock integer;
BEGIN
  IF NOT public.is_owner_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only owner admin can update inventory';
  END IF;

  IF p_quantity = 0 THEN
    RAISE EXCEPTION 'Quantity adjustment cannot be zero';
  END IF;

  IF p_variant_id IS NOT NULL THEN
    SELECT stock INTO v_previous_stock
    FROM public.product_variants
    WHERE id = p_variant_id AND product_id = p_product_id
    FOR UPDATE;

    UPDATE public.product_variants
    SET
      stock = GREATEST(stock + p_quantity, 0),
      damaged_stock = damaged_stock + CASE WHEN p_movement_type = 'damaged' THEN abs(p_quantity) ELSE 0 END,
      returned_stock = returned_stock + CASE WHEN p_movement_type = 'returned' THEN abs(p_quantity) ELSE 0 END
    WHERE id = p_variant_id AND product_id = p_product_id
    RETURNING stock INTO v_new_stock;
  ELSE
    SELECT stock INTO v_previous_stock
    FROM public.products
    WHERE id = p_product_id
    FOR UPDATE;

    UPDATE public.products
    SET
      stock = GREATEST(stock + p_quantity, 0),
      damaged_stock = damaged_stock + CASE WHEN p_movement_type = 'damaged' THEN abs(p_quantity) ELSE 0 END,
      returned_stock = returned_stock + CASE WHEN p_movement_type = 'returned' THEN abs(p_quantity) ELSE 0 END
    WHERE id = p_product_id
    RETURNING stock INTO v_new_stock;
  END IF;

  PERFORM public.log_inventory_event(
    p_product_id,
    p_variant_id,
    NULL,
    p_movement_type,
    p_quantity,
    v_previous_stock,
    v_new_stock,
    p_note
  );

  RETURN jsonb_build_object('ok', true, 'previous_stock', v_previous_stock, 'new_stock', v_new_stock);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.append_order_event(uuid, text, text, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.append_order_event(uuid, text, text, jsonb, boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.log_inventory_event(uuid, uuid, uuid, text, integer, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_inventory_event(uuid, uuid, uuid, text, integer, integer, integer, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.move_reserved_stock_to_sold(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_reserved_stock_to_sold(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_order_operations(uuid, text, text, text, text, date, date, date, text, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_order_operations(uuid, text, text, text, text, date, date, date, text, text, text, text, text, boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.adjust_inventory_stock(uuid, uuid, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_inventory_stock(uuid, uuid, integer, text, text) TO authenticated, service_role;

INSERT INTO public.order_events (order_id, event_type, label, visible_to_customer, created_at)
SELECT id, 'order_created', 'Order Created', true, created_at
FROM public.orders o
WHERE NOT EXISTS (
  SELECT 1 FROM public.order_events e WHERE e.order_id = o.id AND e.event_type = 'order_created'
);
