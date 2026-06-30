-- Extend inventory movement enum
ALTER TYPE public.inventory_movement_type ADD VALUE IF NOT EXISTS 'supplier_return';
ALTER TYPE public.inventory_movement_type ADD VALUE IF NOT EXISTS 'supplier_return_delete';

-- supplier_returns table
CREATE TABLE public.supplier_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  purchase_id uuid NOT NULL,
  supplier_id uuid,
  return_number text,
  refund_method public.payment_method NOT NULL DEFAULT 'cash',
  total_refund numeric NOT NULL DEFAULT 0,
  reason text,
  notes text,
  processed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_returns_shop ON public.supplier_returns(shop_id, created_at DESC);
CREATE INDEX idx_supplier_returns_purchase ON public.supplier_returns(purchase_id);

ALTER TABLE public.supplier_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view supplier returns"
  ON public.supplier_returns FOR SELECT
  USING (public.is_shop_member(auth.uid(), shop_id));

CREATE POLICY "Owners/managers create supplier returns"
  ON public.supplier_returns FOR INSERT
  WITH CHECK (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role, 'manager'::shop_role])
             AND auth.uid() = processed_by);

CREATE POLICY "Owners/managers update supplier returns"
  ON public.supplier_returns FOR UPDATE
  USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role, 'manager'::shop_role]));

CREATE POLICY "Owners delete supplier returns"
  ON public.supplier_returns FOR DELETE
  USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role]));

-- supplier_return_items
CREATE TABLE public.supplier_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.supplier_returns(id) ON DELETE CASCADE,
  purchase_item_id uuid,
  product_id uuid,
  variant_id uuid,
  product_name text NOT NULL,
  quantity numeric NOT NULL,
  unit_cost numeric NOT NULL,
  line_total numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_return_items_return ON public.supplier_return_items(return_id);

ALTER TABLE public.supplier_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view supplier return items"
  ON public.supplier_return_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.supplier_returns r
                 WHERE r.id = supplier_return_items.return_id
                   AND public.is_shop_member(auth.uid(), r.shop_id)));

CREATE POLICY "Owners/managers create supplier return items"
  ON public.supplier_return_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.supplier_returns r
                      WHERE r.id = supplier_return_items.return_id
                        AND public.has_shop_role(auth.uid(), r.shop_id,
                            ARRAY['owner'::shop_role, 'manager'::shop_role])));

-- Stock decrement trigger on supplier return item insert
CREATE OR REPLACE FUNCTION public.decrement_stock_on_supplier_return()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_shop uuid;
  v_user uuid;
  v_new_stock numeric;
BEGIN
  SELECT shop_id, processed_by INTO v_shop, v_user FROM public.supplier_returns WHERE id = NEW.return_id;

  IF NEW.variant_id IS NOT NULL THEN
    UPDATE public.product_variants SET stock = stock - NEW.quantity
    WHERE id = NEW.variant_id RETURNING stock INTO v_new_stock;
  ELSIF NEW.product_id IS NOT NULL THEN
    UPDATE public.products SET stock = stock - NEW.quantity
    WHERE id = NEW.product_id RETURNING stock INTO v_new_stock;
  END IF;

  IF v_shop IS NOT NULL AND (NEW.product_id IS NOT NULL OR NEW.variant_id IS NOT NULL) THEN
    INSERT INTO public.inventory_movements(shop_id, product_id, variant_id, movement_type, quantity, stock_after, reference_type, reference_id, created_by)
    VALUES (v_shop, NEW.product_id, NEW.variant_id, 'supplier_return', -NEW.quantity, v_new_stock, 'supplier_return', NEW.return_id, v_user);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_supplier_return_item_insert
  AFTER INSERT ON public.supplier_return_items
  FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_supplier_return();

-- Reverse on delete
CREATE OR REPLACE FUNCTION public.reverse_stock_on_supplier_return_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_shop uuid;
  v_new_stock numeric;
BEGIN
  SELECT shop_id INTO v_shop FROM public.supplier_returns WHERE id = OLD.return_id;

  IF OLD.variant_id IS NOT NULL THEN
    UPDATE public.product_variants SET stock = stock + OLD.quantity
    WHERE id = OLD.variant_id RETURNING stock INTO v_new_stock;
  ELSIF OLD.product_id IS NOT NULL THEN
    UPDATE public.products SET stock = stock + OLD.quantity
    WHERE id = OLD.product_id RETURNING stock INTO v_new_stock;
  END IF;

  IF v_shop IS NOT NULL AND (OLD.product_id IS NOT NULL OR OLD.variant_id IS NOT NULL) THEN
    INSERT INTO public.inventory_movements(shop_id, product_id, variant_id, movement_type, quantity, stock_after, reference_type, reference_id, created_by)
    VALUES (v_shop, OLD.product_id, OLD.variant_id, 'supplier_return_delete', OLD.quantity, v_new_stock, 'supplier_return', OLD.return_id, auth.uid());
  END IF;
  RETURN OLD;
END; $$;

CREATE TRIGGER trg_supplier_return_item_delete
  BEFORE DELETE ON public.supplier_return_items
  FOR EACH ROW EXECUTE FUNCTION public.reverse_stock_on_supplier_return_delete();

-- Delete RPC (owners only)
CREATE OR REPLACE FUNCTION public.delete_supplier_return(_return_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_shop_id uuid;
BEGIN
  SELECT shop_id INTO v_shop_id FROM public.supplier_returns WHERE id = _return_id;
  IF v_shop_id IS NULL THEN RAISE EXCEPTION 'Supplier return not found'; END IF;
  IF NOT public.has_shop_role(auth.uid(), v_shop_id, ARRAY['owner'::shop_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.supplier_return_items WHERE return_id = _return_id;
  DELETE FROM public.supplier_returns WHERE id = _return_id;
END; $$;