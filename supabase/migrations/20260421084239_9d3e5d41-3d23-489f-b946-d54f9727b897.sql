
-- =========================================================
-- Phase 2 schema: staff lookup, suppliers, purchases, expenses, notifications
-- =========================================================

-- 1. Helper: find user by email (security definer so we can read auth.users)
CREATE OR REPLACE FUNCTION public.find_user_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
$$;

-- =========================================================
-- 2. Suppliers
-- =========================================================
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view suppliers" ON public.suppliers
  FOR SELECT USING (is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Owners/managers create suppliers" ON public.suppliers
  FOR INSERT WITH CHECK (has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]));
CREATE POLICY "Owners/managers update suppliers" ON public.suppliers
  FOR UPDATE USING (has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]));
CREATE POLICY "Owners/managers delete suppliers" ON public.suppliers
  FOR DELETE USING (has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]));

CREATE TRIGGER suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 3. Purchases (stock-in)
-- =========================================================
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  reference_number text,
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners/managers view purchases" ON public.purchases
  FOR SELECT USING (has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]));
CREATE POLICY "Owners/managers create purchases" ON public.purchases
  FOR INSERT WITH CHECK (has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]) AND auth.uid() = created_by);
CREATE POLICY "Owners delete purchases" ON public.purchases
  FOR DELETE USING (has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role]));

CREATE TABLE public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit_cost numeric NOT NULL,
  quantity numeric NOT NULL,
  line_total numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view purchase items via purchase" ON public.purchase_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.purchases p
    WHERE p.id = purchase_items.purchase_id
      AND has_shop_role(auth.uid(), p.shop_id, ARRAY['owner'::shop_role,'manager'::shop_role])
  ));
CREATE POLICY "Owners/managers create purchase items" ON public.purchase_items
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.purchases p
    WHERE p.id = purchase_items.purchase_id
      AND has_shop_role(auth.uid(), p.shop_id, ARRAY['owner'::shop_role,'manager'::shop_role])
  ));

-- Trigger: increment stock on purchase item insert
CREATE OR REPLACE FUNCTION public.increment_stock_on_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products
    SET stock = stock + NEW.quantity
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER purchase_items_increment_stock
  AFTER INSERT ON public.purchase_items
  FOR EACH ROW EXECUTE FUNCTION public.increment_stock_on_purchase();

-- Also wire the existing decrement trigger to sale_items if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'sale_items_decrement_stock'
  ) THEN
    CREATE TRIGGER sale_items_decrement_stock
      AFTER INSERT ON public.sale_items
      FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_sale();
  END IF;
END$$;

-- =========================================================
-- 4. Expenses
-- =========================================================
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view expense categories" ON public.expense_categories
  FOR SELECT USING (is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Owners/managers manage expense categories ins" ON public.expense_categories
  FOR INSERT WITH CHECK (has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]));
CREATE POLICY "Owners/managers manage expense categories upd" ON public.expense_categories
  FOR UPDATE USING (has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]));
CREATE POLICY "Owners/managers manage expense categories del" ON public.expense_categories
  FOR DELETE USING (has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]));

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  paid_to text,
  description text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  receipt_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners/managers view expenses" ON public.expenses
  FOR SELECT USING (has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]));
CREATE POLICY "Owners/managers create expenses" ON public.expenses
  FOR INSERT WITH CHECK (has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]) AND auth.uid() = created_by);
CREATE POLICY "Owners/managers update expenses" ON public.expenses
  FOR UPDATE USING (has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]));
CREATE POLICY "Owners/managers delete expenses" ON public.expenses
  FOR DELETE USING (has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]));

-- Auto-seed default categories when a shop is created
CREATE OR REPLACE FUNCTION public.seed_default_expense_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.expense_categories (shop_id, name, color) VALUES
    (NEW.id, 'Salary', '#3b82f6'),
    (NEW.id, 'Rent', '#8b5cf6'),
    (NEW.id, 'Utilities', '#f59e0b'),
    (NEW.id, 'Marketing', '#ec4899'),
    (NEW.id, 'Other', '#64748b');
  RETURN NEW;
END;
$$;

CREATE TRIGGER shops_seed_expense_categories
  AFTER INSERT ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_expense_categories();

-- Backfill defaults for existing shops
INSERT INTO public.expense_categories (shop_id, name, color)
SELECT s.id, c.name, c.color
FROM public.shops s
CROSS JOIN (VALUES
  ('Salary','#3b82f6'),
  ('Rent','#8b5cf6'),
  ('Utilities','#f59e0b'),
  ('Marketing','#ec4899'),
  ('Other','#64748b')
) AS c(name, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.expense_categories ec WHERE ec.shop_id = s.id
);

-- =========================================================
-- 5. Sale notifications (WhatsApp delivery log)
-- =========================================================
CREATE TABLE public.sale_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL,
  channel text NOT NULL,            -- 'whatsapp'
  kind text NOT NULL,               -- 'receipt' | 'thank_you'
  to_address text NOT NULL,
  provider_sid text,
  status text NOT NULL DEFAULT 'queued',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sale_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view sale notifications" ON public.sale_notifications
  FOR SELECT USING (is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Members create sale notifications" ON public.sale_notifications
  FOR INSERT WITH CHECK (is_shop_member(auth.uid(), shop_id));
