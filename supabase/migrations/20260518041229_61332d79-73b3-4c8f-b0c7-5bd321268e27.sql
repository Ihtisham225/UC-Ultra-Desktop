
-- Enum for movement types
CREATE TYPE public.inventory_movement_type AS ENUM (
  'sale', 'sale_delete', 'purchase', 'purchase_delete',
  'return', 'return_delete', 'adjustment', 'initial'
);

-- Ledger table
CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  product_id uuid,
  variant_id uuid,
  movement_type public.inventory_movement_type NOT NULL,
  quantity numeric NOT NULL,
  stock_after numeric,
  reason text,
  notes text,
  reference_type text,
  reference_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inv_mov_shop_created ON public.inventory_movements(shop_id, created_at DESC);
CREATE INDEX idx_inv_mov_product ON public.inventory_movements(product_id, created_at DESC);
CREATE INDEX idx_inv_mov_variant ON public.inventory_movements(variant_id, created_at DESC);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view inventory movements"
  ON public.inventory_movements FOR SELECT
  USING (public.is_shop_member(auth.uid(), shop_id));

CREATE POLICY "Owners/managers insert manual adjustments"
  ON public.inventory_movements FOR INSERT
  WITH CHECK (
    public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role, 'manager'::shop_role])
    AND movement_type = 'adjustment'
    AND auth.uid() = created_by
  );

-- Updated stock triggers (also write ledger entries)

CREATE OR REPLACE FUNCTION public.decrement_stock_on_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shop uuid;
  v_new_stock numeric;
  v_user uuid;
BEGIN
  SELECT shop_id, cashier_id INTO v_shop, v_user FROM public.sales WHERE id = NEW.sale_id;

  IF NEW.variant_id IS NOT NULL THEN
    UPDATE public.product_variants SET stock = stock - NEW.quantity
    WHERE id = NEW.variant_id
    RETURNING stock INTO v_new_stock;
  ELSIF NEW.product_id IS NOT NULL THEN
    UPDATE public.products SET stock = stock - NEW.quantity
    WHERE id = NEW.product_id
    RETURNING stock INTO v_new_stock;
  END IF;

  IF v_shop IS NOT NULL AND (NEW.product_id IS NOT NULL OR NEW.variant_id IS NOT NULL) THEN
    INSERT INTO public.inventory_movements(shop_id, product_id, variant_id, movement_type, quantity, stock_after, reference_type, reference_id, created_by)
    VALUES (v_shop, NEW.product_id, NEW.variant_id, 'sale', -NEW.quantity, v_new_stock, 'sale', NEW.sale_id, v_user);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.reverse_stock_on_sale_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shop uuid;
  v_new_stock numeric;
BEGIN
  SELECT shop_id INTO v_shop FROM public.sales WHERE id = OLD.sale_id;

  IF OLD.variant_id IS NOT NULL THEN
    UPDATE public.product_variants SET stock = stock + OLD.quantity
    WHERE id = OLD.variant_id
    RETURNING stock INTO v_new_stock;
  ELSIF OLD.product_id IS NOT NULL THEN
    UPDATE public.products SET stock = stock + OLD.quantity
    WHERE id = OLD.product_id
    RETURNING stock INTO v_new_stock;
  END IF;

  IF v_shop IS NOT NULL AND (OLD.product_id IS NOT NULL OR OLD.variant_id IS NOT NULL) THEN
    INSERT INTO public.inventory_movements(shop_id, product_id, variant_id, movement_type, quantity, stock_after, reference_type, reference_id, created_by)
    VALUES (v_shop, OLD.product_id, OLD.variant_id, 'sale_delete', OLD.quantity, v_new_stock, 'sale', OLD.sale_id, auth.uid());
  END IF;
  RETURN OLD;
END; $$;

CREATE OR REPLACE FUNCTION public.increment_stock_on_purchase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shop uuid;
  v_user uuid;
  v_new_stock numeric;
BEGIN
  SELECT shop_id, created_by INTO v_shop, v_user FROM public.purchases WHERE id = NEW.purchase_id;

  IF NEW.variant_id IS NOT NULL THEN
    UPDATE public.product_variants SET stock = stock + NEW.quantity
    WHERE id = NEW.variant_id
    RETURNING stock INTO v_new_stock;
  ELSIF NEW.product_id IS NOT NULL THEN
    UPDATE public.products SET stock = stock + NEW.quantity
    WHERE id = NEW.product_id
    RETURNING stock INTO v_new_stock;
  END IF;

  IF v_shop IS NOT NULL AND (NEW.product_id IS NOT NULL OR NEW.variant_id IS NOT NULL) THEN
    INSERT INTO public.inventory_movements(shop_id, product_id, variant_id, movement_type, quantity, stock_after, reference_type, reference_id, created_by)
    VALUES (v_shop, NEW.product_id, NEW.variant_id, 'purchase', NEW.quantity, v_new_stock, 'purchase', NEW.purchase_id, v_user);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.reverse_stock_on_purchase_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shop uuid;
  v_new_stock numeric;
BEGIN
  SELECT shop_id INTO v_shop FROM public.purchases WHERE id = OLD.purchase_id;

  IF OLD.variant_id IS NOT NULL THEN
    UPDATE public.product_variants SET stock = stock - OLD.quantity
    WHERE id = OLD.variant_id
    RETURNING stock INTO v_new_stock;
  ELSIF OLD.product_id IS NOT NULL THEN
    UPDATE public.products SET stock = stock - OLD.quantity
    WHERE id = OLD.product_id
    RETURNING stock INTO v_new_stock;
  END IF;

  IF v_shop IS NOT NULL AND (OLD.product_id IS NOT NULL OR OLD.variant_id IS NOT NULL) THEN
    INSERT INTO public.inventory_movements(shop_id, product_id, variant_id, movement_type, quantity, stock_after, reference_type, reference_id, created_by)
    VALUES (v_shop, OLD.product_id, OLD.variant_id, 'purchase_delete', -OLD.quantity, v_new_stock, 'purchase', OLD.purchase_id, auth.uid());
  END IF;
  RETURN OLD;
END; $$;

CREATE OR REPLACE FUNCTION public.restore_stock_on_return()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shop uuid;
  v_user uuid;
  v_new_stock numeric;
BEGIN
  SELECT shop_id, processed_by INTO v_shop, v_user FROM public.sale_returns WHERE id = NEW.return_id;

  IF NEW.variant_id IS NOT NULL THEN
    UPDATE public.product_variants SET stock = stock + NEW.quantity
    WHERE id = NEW.variant_id
    RETURNING stock INTO v_new_stock;
  ELSIF NEW.product_id IS NOT NULL THEN
    UPDATE public.products SET stock = stock + NEW.quantity
    WHERE id = NEW.product_id
    RETURNING stock INTO v_new_stock;
  END IF;

  IF v_shop IS NOT NULL AND (NEW.product_id IS NOT NULL OR NEW.variant_id IS NOT NULL) THEN
    INSERT INTO public.inventory_movements(shop_id, product_id, variant_id, movement_type, quantity, stock_after, reference_type, reference_id, created_by)
    VALUES (v_shop, NEW.product_id, NEW.variant_id, 'return', NEW.quantity, v_new_stock, 'return', NEW.return_id, v_user);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.reverse_stock_on_return_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shop uuid;
  v_new_stock numeric;
BEGIN
  SELECT shop_id INTO v_shop FROM public.sale_returns WHERE id = OLD.return_id;

  IF OLD.variant_id IS NOT NULL THEN
    UPDATE public.product_variants SET stock = stock - OLD.quantity
    WHERE id = OLD.variant_id
    RETURNING stock INTO v_new_stock;
  ELSIF OLD.product_id IS NOT NULL THEN
    UPDATE public.products SET stock = stock - OLD.quantity
    WHERE id = OLD.product_id
    RETURNING stock INTO v_new_stock;
  END IF;

  IF v_shop IS NOT NULL AND (OLD.product_id IS NOT NULL OR OLD.variant_id IS NOT NULL) THEN
    INSERT INTO public.inventory_movements(shop_id, product_id, variant_id, movement_type, quantity, stock_after, reference_type, reference_id, created_by)
    VALUES (v_shop, OLD.product_id, OLD.variant_id, 'return_delete', -OLD.quantity, v_new_stock, 'return', OLD.return_id, auth.uid());
  END IF;
  RETURN OLD;
END; $$;

-- Manual adjustment RPC
CREATE OR REPLACE FUNCTION public.adjust_stock(
  _product_id uuid,
  _variant_id uuid,
  _delta numeric,
  _reason text,
  _notes text
) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shop uuid;
  v_new_stock numeric;
BEGIN
  IF _variant_id IS NOT NULL THEN
    SELECT shop_id INTO v_shop FROM public.product_variants WHERE id = _variant_id;
  ELSIF _product_id IS NOT NULL THEN
    SELECT shop_id INTO v_shop FROM public.products WHERE id = _product_id;
  ELSE
    RAISE EXCEPTION 'Must supply product_id or variant_id';
  END IF;

  IF v_shop IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF NOT public.has_shop_role(auth.uid(), v_shop, ARRAY['owner'::shop_role, 'manager'::shop_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _delta = 0 THEN
    RAISE EXCEPTION 'Delta cannot be zero';
  END IF;

  IF _variant_id IS NOT NULL THEN
    UPDATE public.product_variants SET stock = stock + _delta WHERE id = _variant_id
    RETURNING stock INTO v_new_stock;
  ELSE
    UPDATE public.products SET stock = stock + _delta WHERE id = _product_id
    RETURNING stock INTO v_new_stock;
  END IF;

  INSERT INTO public.inventory_movements(shop_id, product_id, variant_id, movement_type, quantity, stock_after, reason, notes, created_by)
  VALUES (v_shop, _product_id, _variant_id, 'adjustment', _delta, v_new_stock, _reason, _notes, auth.uid());

  RETURN v_new_stock;
END; $$;
