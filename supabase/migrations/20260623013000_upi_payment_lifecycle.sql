ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_utr_unique
  ON public.orders (lower(payment_utr))
  WHERE payment_utr IS NOT NULL AND payment_utr <> '';

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
      UPDATE public.product_variants
      SET stock = stock + v_qty
      WHERE id = v_variant_id
        AND product_id = v_product_id;
    ELSE
      UPDATE public.products
      SET stock = stock + v_qty
      WHERE id = v_product_id;
    END IF;
  END LOOP;

  UPDATE public.orders
  SET stock_deducted_at = NULL
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'already_released', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_upi_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_release jsonb;
BEGIN
  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_order.payment_method <> 'upi' THEN
    RAISE EXCEPTION 'Order % is not a UPI order', p_order_id;
  END IF;

  IF v_order.status = 'confirmed' OR v_order.payment_status IN ('approved', 'paid', 'manual_confirmed') THEN
    RETURN jsonb_build_object('ok', true, 'already_confirmed', true);
  END IF;

  IF v_order.payment_status = 'expired' THEN
    RETURN jsonb_build_object('ok', true, 'already_expired', true);
  END IF;

  IF v_order.payment_expires_at IS NOT NULL AND v_order.payment_expires_at > now() THEN
    RAISE EXCEPTION 'Order % has not expired yet', p_order_id;
  END IF;

  v_release := public.release_order_stock_locked(p_order_id);

  UPDATE public.orders
  SET
    status = 'expired',
    payment_status = 'expired'
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'already_expired', false, 'stock', v_release);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_manual_payment(
  p_order_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_release jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can reject payments';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_order.status = 'confirmed' OR v_order.payment_status IN ('approved', 'paid', 'manual_confirmed') THEN
    RAISE EXCEPTION 'Cannot reject confirmed order %', p_order_id;
  END IF;

  v_release := public.release_order_stock_locked(p_order_id);

  UPDATE public.orders
  SET
    status = 'payment_rejected',
    payment_status = 'rejected',
    payment_rejection_reason = NULLIF(trim(COALESCE(p_reason, '')), '')
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'stock', v_release);
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_due_upi_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_count integer := 0;
BEGIN
  FOR v_order_id IN
    SELECT id
    FROM public.orders
    WHERE payment_method = 'upi'
      AND payment_status IN ('awaiting_payment', 'rejected')
      AND status <> 'confirmed'
      AND payment_expires_at IS NOT NULL
      AND payment_expires_at <= now()
  LOOP
    PERFORM public.expire_upi_order(v_order_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'expired_count', v_count);
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
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can confirm manual orders';
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

  IF v_order.status = 'confirmed' AND v_order.stock_deducted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_confirmed', true);
  END IF;

  v_stock := public.apply_order_stock_locked(p_order_id);

  UPDATE public.orders
  SET
    status = 'confirmed',
    payment_status = CASE
      WHEN payment_status IN ('paid', 'approved') THEN payment_status
      WHEN payment_method = 'upi' THEN 'approved'
      ELSE 'manual_confirmed'
    END,
    payment_verified_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'already_confirmed', false, 'stock', v_stock);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.release_order_stock_locked(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_order_stock_locked(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.expire_upi_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_upi_order(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.expire_due_upi_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_due_upi_orders() TO service_role;

REVOKE EXECUTE ON FUNCTION public.reject_manual_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_manual_payment(uuid, text) TO authenticated, service_role;
