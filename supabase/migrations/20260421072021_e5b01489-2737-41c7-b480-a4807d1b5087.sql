-- ============ ENUMS ============
CREATE TYPE public.shop_role AS ENUM ('owner', 'manager', 'cashier');
CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'mobile', 'other');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ SHOPS ============
CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  receipt_footer TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

-- ============ SHOP MEMBERS ============
CREATE TABLE public.shop_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.shop_role NOT NULL DEFAULT 'cashier',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, user_id)
);
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_shop_members_user ON public.shop_members(user_id);
CREATE INDEX idx_shop_members_shop ON public.shop_members(shop_id);

-- ============ SECURITY DEFINER HELPERS ============
CREATE OR REPLACE FUNCTION public.is_shop_member(_user_id UUID, _shop_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shop_members WHERE user_id = _user_id AND shop_id = _shop_id);
$$;

CREATE OR REPLACE FUNCTION public.has_shop_role(_user_id UUID, _shop_id UUID, _roles public.shop_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_members
    WHERE user_id = _user_id AND shop_id = _shop_id AND role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_shop_role(_user_id UUID, _shop_id UUID)
RETURNS public.shop_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.shop_members WHERE user_id = _user_id AND shop_id = _shop_id LIMIT 1;
$$;

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  category TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC(12,2) NOT NULL DEFAULT 5,
  unit TEXT DEFAULT 'pcs',
  is_active BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_products_shop ON public.products(shop_id);
CREATE INDEX idx_products_barcode ON public.products(shop_id, barcode);

-- ============ CUSTOMERS ============
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_customers_shop ON public.customers(shop_id);

-- ============ SALES ============
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  cashier_id UUID NOT NULL REFERENCES auth.users(id),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  change_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  receipt_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sales_shop ON public.sales(shop_id, created_at DESC);

-- ============ SALE ITEMS ============
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);

-- ============ TIMESTAMP TRIGGER ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_shops_updated BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ AUTO-ADD CREATOR AS OWNER ============
CREATE OR REPLACE FUNCTION public.handle_new_shop()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.shop_members (shop_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_shop_created
  AFTER INSERT ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_shop();

-- ============ STOCK DECREMENT ON SALE ITEM ============
CREATE OR REPLACE FUNCTION public.decrement_stock_on_sale()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products
    SET stock = stock - NEW.quantity
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_decrement_stock
  AFTER INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_sale();

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- shops
CREATE POLICY "Members view their shops" ON public.shops FOR SELECT
  USING (public.is_shop_member(auth.uid(), id));
CREATE POLICY "Authenticated users create shops" ON public.shops FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owners update shop" ON public.shops FOR UPDATE
  USING (public.has_shop_role(auth.uid(), id, ARRAY['owner']::public.shop_role[]));
CREATE POLICY "Owners delete shop" ON public.shops FOR DELETE
  USING (public.has_shop_role(auth.uid(), id, ARRAY['owner']::public.shop_role[]));

-- shop_members
CREATE POLICY "Members view shop members" ON public.shop_members FOR SELECT
  USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Owners/managers add members" ON public.shop_members FOR INSERT
  WITH CHECK (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner','manager']::public.shop_role[]));
CREATE POLICY "Owners/managers update members" ON public.shop_members FOR UPDATE
  USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner','manager']::public.shop_role[]));
CREATE POLICY "Owners/managers remove members" ON public.shop_members FOR DELETE
  USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner','manager']::public.shop_role[]));

-- products
CREATE POLICY "Members view products" ON public.products FOR SELECT
  USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Owners/managers create products" ON public.products FOR INSERT
  WITH CHECK (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner','manager']::public.shop_role[]));
CREATE POLICY "Owners/managers update products" ON public.products FOR UPDATE
  USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner','manager']::public.shop_role[]));
CREATE POLICY "Owners/managers delete products" ON public.products FOR DELETE
  USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner','manager']::public.shop_role[]));

-- customers
CREATE POLICY "Members view customers" ON public.customers FOR SELECT
  USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Members create customers" ON public.customers FOR INSERT
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Owners/managers update customers" ON public.customers FOR UPDATE
  USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner','manager']::public.shop_role[]));
CREATE POLICY "Owners/managers delete customers" ON public.customers FOR DELETE
  USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner','manager']::public.shop_role[]));

-- sales
CREATE POLICY "Members view sales" ON public.sales FOR SELECT
  USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Members create sales" ON public.sales FOR INSERT
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) AND auth.uid() = cashier_id);
CREATE POLICY "Owners delete sales" ON public.sales FOR DELETE
  USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner']::public.shop_role[]));

-- sale_items
CREATE POLICY "Members view sale items" ON public.sale_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND public.is_shop_member(auth.uid(), s.shop_id)));
CREATE POLICY "Members create sale items" ON public.sale_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND public.is_shop_member(auth.uid(), s.shop_id)));