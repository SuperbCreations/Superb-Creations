ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_deducted_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS orders_razorpay_payment_id_unique
  ON public.orders(razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

REVOKE INSERT ON public.orders FROM anon, authenticated;
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;

REVOKE EXECUTE ON FUNCTION public.decrement_stock(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_stock(jsonb) TO service_role;

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
    RETURN jsonb_build_object('ok', true, 'already_applied', true);
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
      SET stock = stock - v_qty
      WHERE id = v_variant_id
        AND product_id = v_product_id
        AND stock >= v_qty;
    ELSE
      UPDATE public.products
      SET stock = stock - v_qty
      WHERE id = v_product_id
        AND stock >= v_qty;
    END IF;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      RAISE EXCEPTION 'Insufficient stock for item % in order %', v_item, p_order_id;
    END IF;
  END LOOP;

  UPDATE public.orders
  SET stock_deducted_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'already_applied', false);
END;
$$;

DROP FUNCTION IF EXISTS public.finalize_razorpay_payment(uuid, text, text);

CREATE OR REPLACE FUNCTION public.finalize_razorpay_payment(
  p_order_id uuid,
  p_razorpay_order_id text,
  p_razorpay_payment_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_stock jsonb;
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

  IF v_order.razorpay_order_id IS NOT NULL
     AND p_razorpay_order_id IS NOT NULL
     AND v_order.razorpay_order_id <> p_razorpay_order_id THEN
    RAISE EXCEPTION 'Razorpay order mismatch for order %', p_order_id;
  END IF;

  v_stock := public.apply_order_stock_locked(p_order_id);

  UPDATE public.orders
  SET
    payment_status = 'paid',
    status = 'confirmed',
    razorpay_order_id = COALESCE(p_razorpay_order_id, razorpay_order_id),
    razorpay_payment_id = COALESCE(p_razorpay_payment_id, razorpay_payment_id)
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'already_paid', false, 'stock', v_stock);
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
      WHEN payment_status = 'paid' THEN payment_status
      ELSE 'manual_confirmed'
    END
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'already_confirmed', false, 'stock', v_stock);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_order_stock_locked(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_order_stock_locked(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.finalize_razorpay_payment(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_razorpay_payment(uuid, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.confirm_manual_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_manual_order(uuid) TO authenticated, service_role;
