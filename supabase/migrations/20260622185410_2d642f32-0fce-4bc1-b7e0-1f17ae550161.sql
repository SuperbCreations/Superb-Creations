CREATE OR REPLACE FUNCTION public.confirm_manual_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_decrement_result jsonb;
BEGIN
  -- Authorization: caller must be admin
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  -- Lock the row to prevent concurrent confirmations
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  -- Reject invalid states
  IF v_order.status IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Order is % and cannot be confirmed', v_order.status USING ERRCODE = '22023';
  END IF;

  -- Idempotency: already confirmed + paid → no-op
  IF v_order.status = 'confirmed' AND v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already_confirmed', true, 'order_id', p_order_id);
  END IF;

  -- Decrement stock exactly once. Only when payment was not already paid
  -- (paid orders already had stock decremented at order-creation/payment time).
  IF v_order.payment_status <> 'paid' THEN
    v_decrement_result := public.decrement_stock(COALESCE(v_order.items, '[]'::jsonb));
    IF jsonb_array_length(COALESCE(v_decrement_result->'failed', '[]'::jsonb)) > 0 THEN
      RAISE EXCEPTION 'Insufficient stock for one or more items: %', v_decrement_result->'failed'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  UPDATE public.orders
     SET payment_status = 'paid',
         status = 'confirmed'
   WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'already_confirmed', false, 'order_id', p_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_manual_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_manual_order(uuid) TO authenticated, service_role;