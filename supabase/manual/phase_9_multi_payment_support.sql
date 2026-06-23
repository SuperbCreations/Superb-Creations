CREATE TABLE IF NOT EXISTS public.payment_methods (
  method_key text PRIMARY KEY,
  display_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  verification_time text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  min_order_amount numeric NOT NULL DEFAULT 0,
  max_order_amount numeric,
  extra_fee numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  recommended boolean NOT NULL DEFAULT false,
  provider text NOT NULL DEFAULT 'manual',
  public_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  admin_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.payment_methods (
  method_key,
  display_name,
  description,
  instructions,
  verification_time,
  enabled,
  min_order_amount,
  max_order_amount,
  extra_fee,
  sort_order,
  recommended,
  provider,
  public_details
)
VALUES
  ('upi', 'Manual UPI Payment', 'Pay by any UPI app and submit your UTR for verification.', 'Pay the exact amount to the displayed UPI ID, then submit the UTR/reference.', 'Usually verified within business hours.', true, 0, null, 0, 10, true, 'manual_upi', '{}'::jsonb),
  ('razorpay', 'Online Payment', 'Pay instantly by card, UPI, wallet or netbanking through Razorpay.', 'Complete payment securely in the Razorpay checkout window.', 'Instant after successful provider confirmation.', false, 0, null, 0, 20, false, 'razorpay', '{}'::jsonb),
  ('cod', 'Cash on Delivery', 'Pay in cash when your order is delivered.', 'Keep exact change ready. COD orders are confirmed by the store before dispatch.', 'Confirmed by admin before packing.', false, 0, null, 0, 30, false, 'manual_cod', '{}'::jsonb),
  ('bank_transfer', 'Bank Transfer', 'Transfer to the store bank account and submit the transaction reference.', 'Transfer the exact amount to the displayed bank account, then submit the reference.', 'Usually verified within business hours.', false, 0, null, 0, 40, false, 'manual_bank', '{}'::jsonb)
ON CONFLICT (method_key) DO NOTHING;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_failure_reason text,
  ADD COLUMN IF NOT EXISTS payment_verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refund_amount numeric,
  ADD COLUMN IF NOT EXISTS refund_reference text,
  ADD COLUMN IF NOT EXISTS refund_notes text;

UPDATE public.orders
SET payment_reference = COALESCE(payment_reference, payment_utr)
WHERE payment_utr IS NOT NULL AND payment_reference IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_reference_unique
  ON public.orders (lower(payment_reference))
  WHERE payment_reference IS NOT NULL AND payment_reference <> '';

CREATE INDEX IF NOT EXISTS orders_payment_method_status_idx
  ON public.orders(payment_method, payment_status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  method text NOT NULL,
  provider text NOT NULL DEFAULT 'manual',
  amount numeric NOT NULL DEFAULT 0,
  fee numeric NOT NULL DEFAULT 0,
  status text NOT NULL,
  reference_id text,
  provider_order_id text,
  provider_payment_id text,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  failure_reason text,
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_ledger_provider_payment_unique
  ON public.payment_ledger(provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL AND provider_payment_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS payment_ledger_reference_unique
  ON public.payment_ledger(method, lower(reference_id))
  WHERE reference_id IS NOT NULL AND reference_id <> '';

CREATE INDEX IF NOT EXISTS payment_ledger_order_created_idx
  ON public.payment_ledger(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_ledger_status_created_idx
  ON public.payment_ledger(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','completed')),
  reason text,
  admin_notes text,
  refund_reference text,
  provider text NOT NULL DEFAULT 'manual',
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refund_requests_order_created_idx
  ON public.refund_requests(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS refund_requests_status_created_idx
  ON public.refund_requests(status, created_at DESC);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.payment_methods TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT SELECT ON public.payment_ledger, public.refund_requests TO authenticated;
GRANT INSERT, UPDATE ON public.refund_requests TO authenticated;
GRANT ALL ON public.payment_methods, public.payment_ledger, public.refund_requests TO service_role;

DROP POLICY IF EXISTS "Public can read enabled payment methods" ON public.payment_methods;
CREATE POLICY "Public can read enabled payment methods"
  ON public.payment_methods
  FOR SELECT
  USING (enabled = true OR public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner can manage payment methods" ON public.payment_methods;
CREATE POLICY "Owner can manage payment methods"
  ON public.payment_methods
  FOR ALL TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Customers can read own payment ledger" ON public.payment_ledger;
CREATE POLICY "Customers can read own payment ledger"
  ON public.payment_ledger
  FOR SELECT TO authenticated
  USING (
    public.is_owner_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payment_ledger.order_id
        AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owner can manage payment ledger" ON public.payment_ledger;
CREATE POLICY "Owner can manage payment ledger"
  ON public.payment_ledger
  FOR ALL TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Customers can read own refund requests" ON public.refund_requests;
CREATE POLICY "Customers can read own refund requests"
  ON public.refund_requests
  FOR SELECT TO authenticated
  USING (
    public.is_owner_admin(auth.uid())
    OR requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = refund_requests.order_id
        AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers can request own refunds" ON public.refund_requests;
CREATE POLICY "Customers can request own refunds"
  ON public.refund_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = refund_requests.order_id
        AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owner can manage refund requests" ON public.refund_requests;
CREATE POLICY "Owner can manage refund requests"
  ON public.refund_requests
  FOR ALL TO authenticated
  USING (public.is_owner_admin(auth.uid()))
  WITH CHECK (public.is_owner_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_payment_ledger(
  p_order_id uuid,
  p_method text,
  p_provider text,
  p_amount numeric,
  p_fee numeric,
  p_status text,
  p_reference_id text DEFAULT NULL,
  p_provider_order_id text DEFAULT NULL,
  p_provider_payment_id text DEFAULT NULL,
  p_failure_reason text DEFAULT NULL,
  p_raw_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  BEGIN
    INSERT INTO public.payment_ledger (
      order_id,
      method,
      provider,
      amount,
      fee,
      status,
      reference_id,
      provider_order_id,
      provider_payment_id,
      verified_by,
      verified_at,
      failure_reason,
      raw_metadata
    )
    VALUES (
      p_order_id,
      p_method,
      p_provider,
      COALESCE(p_amount, 0),
      COALESCE(p_fee, 0),
      p_status,
      NULLIF(trim(COALESCE(p_reference_id, '')), ''),
      NULLIF(trim(COALESCE(p_provider_order_id, '')), ''),
      NULLIF(trim(COALESCE(p_provider_payment_id, '')), ''),
      CASE WHEN p_status IN ('paid','approved','manual_confirmed','completed') THEN auth.uid() ELSE NULL END,
      CASE WHEN p_status IN ('paid','approved','manual_confirmed','completed') THEN now() ELSE NULL END,
      NULLIF(trim(COALESCE(p_failure_reason, '')), ''),
      COALESCE(p_raw_metadata, '{}'::jsonb)
    )
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_id
    FROM public.payment_ledger
    WHERE (provider = p_provider AND provider_payment_id = NULLIF(trim(COALESCE(p_provider_payment_id, '')), ''))
       OR (method = p_method AND lower(reference_id) = lower(NULLIF(trim(COALESCE(p_reference_id, '')), '')))
    ORDER BY created_at DESC
    LIMIT 1;
  END;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_manual_payment_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_release jsonb;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_order.payment_method NOT IN ('upi', 'bank_transfer') THEN
    RAISE EXCEPTION 'Order % is not an expirable manual payment order', p_order_id;
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
  SET status = 'expired',
      payment_status = 'expired',
      operational_status = 'payment_expired'
  WHERE id = p_order_id;

  PERFORM public.log_payment_ledger(
    p_order_id,
    v_order.payment_method,
    COALESCE(v_order.payment_provider, 'manual'),
    v_order.total,
    COALESCE(v_order.payment_fee, 0),
    'expired',
    v_order.payment_reference,
    v_order.razorpay_order_id,
    v_order.razorpay_payment_id,
    'Payment window expired',
    '{}'::jsonb
  );

  RETURN jsonb_build_object('ok', true, 'already_expired', false, 'stock', v_release);
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_upi_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.expire_manual_payment_order(p_order_id);
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
  v_status text;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' AND NOT public.is_owner_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only owner admin can confirm manual orders';
  END IF;

  SELECT * INTO v_order
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
  v_status := CASE
    WHEN v_order.payment_method = 'upi' THEN 'approved'
    WHEN v_order.payment_method = 'bank_transfer' THEN 'approved'
    WHEN v_order.payment_method = 'cod' THEN 'manual_confirmed'
    ELSE 'manual_confirmed'
  END;

  UPDATE public.orders
  SET status = 'confirmed',
      operational_status = CASE WHEN v_order.payment_method = 'cod' THEN 'cod_confirmed' ELSE 'payment_approved' END,
      payment_status = v_status,
      payment_verified_at = now(),
      payment_verified_by = auth.uid()
  WHERE id = p_order_id;

  PERFORM public.log_payment_ledger(
    p_order_id,
    v_order.payment_method,
    COALESCE(v_order.payment_provider, 'manual'),
    v_order.total,
    COALESCE(v_order.payment_fee, 0),
    v_status,
    COALESCE(v_order.payment_reference, v_order.payment_utr),
    v_order.razorpay_order_id,
    v_order.razorpay_payment_id,
    NULL,
    '{}'::jsonb
  );

  RETURN jsonb_build_object('ok', true, 'already_confirmed', false, 'stock', v_stock);
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
  IF COALESCE(auth.role(), '') <> 'service_role' AND NOT public.is_owner_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only owner admin can reject payments';
  END IF;

  SELECT * INTO v_order
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
  SET status = 'payment_rejected',
      operational_status = 'payment_rejected',
      payment_status = 'rejected',
      payment_rejection_reason = NULLIF(trim(COALESCE(p_reason, '')), ''),
      payment_failure_reason = NULLIF(trim(COALESCE(p_reason, '')), '')
  WHERE id = p_order_id;

  PERFORM public.log_payment_ledger(
    p_order_id,
    v_order.payment_method,
    COALESCE(v_order.payment_provider, 'manual'),
    v_order.total,
    COALESCE(v_order.payment_fee, 0),
    'rejected',
    COALESCE(v_order.payment_reference, v_order.payment_utr),
    v_order.razorpay_order_id,
    v_order.razorpay_payment_id,
    p_reason,
    '{}'::jsonb
  );

  RETURN jsonb_build_object('ok', true, 'stock', v_release);
END;
$$;

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
  SELECT * INTO v_order
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
  SET payment_status = 'paid',
      status = 'confirmed',
      operational_status = 'payment_approved',
      razorpay_order_id = COALESCE(p_razorpay_order_id, razorpay_order_id),
      razorpay_payment_id = COALESCE(p_razorpay_payment_id, razorpay_payment_id),
      payment_provider = 'razorpay',
      payment_verified_at = now()
  WHERE id = p_order_id;

  PERFORM public.log_payment_ledger(
    p_order_id,
    'razorpay',
    'razorpay',
    v_order.total,
    COALESCE(v_order.payment_fee, 0),
    'paid',
    NULL,
    p_razorpay_order_id,
    p_razorpay_payment_id,
    NULL,
    '{}'::jsonb
  );

  RETURN jsonb_build_object('ok', true, 'already_paid', false, 'stock', v_stock);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_payment_analytics_v2()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' AND NOT public.is_owner_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Owner admin access required';
  END IF;

  RETURN jsonb_build_object(
    'methodUsage', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (
      SELECT payment_method AS method, count(*) AS orders, coalesce(sum(total), 0) AS amount
      FROM public.orders
      GROUP BY payment_method
      ORDER BY count(*) DESC
    ) x), '[]'::jsonb),
    'successRate', jsonb_build_object(
      'total', (SELECT count(*) FROM public.orders),
      'paid', (SELECT count(*) FROM public.orders WHERE payment_status IN ('paid','approved','manual_confirmed')),
      'failed', (SELECT count(*) FROM public.orders WHERE payment_status IN ('failed','rejected','expired'))
    ),
    'pending', jsonb_build_object(
      'upi', (SELECT count(*) FROM public.orders WHERE payment_method = 'upi' AND payment_status IN ('awaiting_payment','under_review')),
      'bankTransfer', (SELECT count(*) FROM public.orders WHERE payment_method = 'bank_transfer' AND payment_status IN ('awaiting_payment','under_review')),
      'cod', (SELECT count(*) FROM public.orders WHERE payment_method = 'cod' AND payment_status = 'cod_pending')
    ),
    'razorpay', jsonb_build_object(
      'paid', (SELECT count(*) FROM public.orders WHERE payment_method = 'razorpay' AND payment_status = 'paid'),
      'failed', (SELECT count(*) FROM public.orders WHERE payment_method = 'razorpay' AND payment_status = 'failed')
    ),
    'refunds', jsonb_build_object(
      'requested', (SELECT count(*) FROM public.refund_requests WHERE status = 'requested'),
      'approved', (SELECT count(*) FROM public.refund_requests WHERE status = 'approved'),
      'completed', (SELECT count(*) FROM public.refund_requests WHERE status = 'completed'),
      'amount', (SELECT coalesce(sum(amount), 0) FROM public.refund_requests WHERE status = 'completed')
    ),
    'feesCollected', (SELECT coalesce(sum(payment_fee), 0) FROM public.orders WHERE payment_status IN ('paid','approved','manual_confirmed'))
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_payment_ledger(uuid, text, text, numeric, numeric, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_payment_ledger(uuid, text, text, numeric, numeric, text, text, text, text, text, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.expire_manual_payment_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_manual_payment_order(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_payment_analytics_v2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_payment_analytics_v2() TO authenticated, service_role;
