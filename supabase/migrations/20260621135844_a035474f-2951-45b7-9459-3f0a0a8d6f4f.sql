-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.ensure_my_role()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF lower(v_email) = 'superbcreations55@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'user')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.ensure_my_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_role() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PRODUCTS
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  price integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  tag text,
  in_stock boolean NOT NULL DEFAULT true,
  stock integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admins can insert products" ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update products" ON public.products
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete products" ON public.products
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PRODUCT VARIANTS
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '',
  color_hex text,
  price integer,
  stock integer NOT NULL DEFAULT 0,
  sku text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, size, color)
);
GRANT SELECT ON public.product_variants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view variants" ON public.product_variants FOR SELECT USING (true);
CREATE POLICY "Admins can insert variants" ON public.product_variants FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update variants" ON public.product_variants FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete variants" ON public.product_variants FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER product_variants_updated_at BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX product_variants_product_id_idx ON public.product_variants(product_id);

-- ORDERS
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  phone text NOT NULL,
  email text,
  address text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total integer NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'whatsapp',
  payment_status text NOT NULL DEFAULT 'pending',
  razorpay_order_id text,
  razorpay_payment_id text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.orders TO anon, authenticated;
GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view orders" ON public.orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update orders" ON public.orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX orders_user_id_idx ON public.orders(user_id);
CREATE INDEX orders_razorpay_order_id_idx ON public.orders(razorpay_order_id);

-- REVIEWS
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT '',
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  approved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view approved reviews" ON public.reviews FOR SELECT
  USING (approved = true OR auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert their own reviews" ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own reviews" ON public.reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reviews" ON public.reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can moderate reviews" ON public.reviews FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete any review" ON public.reviews FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX reviews_product_id_idx ON public.reviews(product_id);

-- ATOMIC STOCK DECREMENT
CREATE OR REPLACE FUNCTION public.decrement_stock(p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec jsonb; v_product uuid; v_variant uuid; v_qty integer; v_updated integer;
  failed jsonb := '[]'::jsonb;
BEGIN
  FOR rec IN SELECT jsonb_array_elements(p_items) LOOP
    v_product := (rec->>'product_id')::uuid;
    v_variant := NULLIF(rec->>'variant_id', '')::uuid;
    v_qty := COALESCE((rec->>'qty')::int, 0);
    IF v_qty <= 0 THEN CONTINUE; END IF;
    IF v_variant IS NOT NULL THEN
      UPDATE public.product_variants SET stock = stock - v_qty
       WHERE id = v_variant AND stock >= v_qty;
      GET DIAGNOSTICS v_updated = ROW_COUNT;
    ELSE
      UPDATE public.products SET stock = stock - v_qty
       WHERE id = v_product AND stock >= v_qty;
      GET DIAGNOSTICS v_updated = ROW_COUNT;
    END IF;
    IF v_updated = 0 THEN failed := failed || rec; END IF;
  END LOOP;
  RETURN jsonb_build_object('failed', failed);
END;
$$;
GRANT EXECUTE ON FUNCTION public.decrement_stock(jsonb) TO anon, authenticated, service_role;

-- STORAGE policies for product-images bucket (bucket created via storage tool)
CREATE POLICY "Public can view product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Admins can upload product images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update product images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete product images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));