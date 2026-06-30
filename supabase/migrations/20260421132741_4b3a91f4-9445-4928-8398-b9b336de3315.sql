-- Returns table
CREATE TABLE public.sale_returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  processed_by UUID NOT NULL,
  return_number TEXT,
  total_refund NUMERIC NOT NULL DEFAULT 0,
  refund_method public.payment_method NOT NULL DEFAULT 'cash',
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sale_returns_shop ON public.sale_returns(shop_id);
CREATE INDEX idx_sale_returns_sale ON public.sale_returns(sale_id);

ALTER TABLE public.sale_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view returns"
  ON public.sale_returns FOR SELECT
  USING (public.is_shop_member(auth.uid(), shop_id));

CREATE POLICY "Owners/managers create returns"
  ON public.sale_returns FOR INSERT
  WITH CHECK (
    public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role])
    AND auth.uid() = processed_by
  );

CREATE POLICY "Owners/managers update returns"
  ON public.sale_returns FOR UPDATE
  USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]));

CREATE POLICY "Owners delete returns"
  ON public.sale_returns FOR DELETE
  USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role]));

-- Return items
CREATE TABLE public.sale_return_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id UUID NOT NULL REFERENCES public.sale_returns(id) ON DELETE CASCADE,
  sale_item_id UUID REFERENCES public.sale_items(id) ON DELETE SET NULL,
  product_id UUID,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  line_total NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sale_return_items_return ON public.sale_return_items(return_id);

ALTER TABLE public.sale_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view return items"
  ON public.sale_return_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sale_returns r
    WHERE r.id = sale_return_items.return_id
      AND public.is_shop_member(auth.uid(), r.shop_id)
  ));

CREATE POLICY "Owners/managers create return items"
  ON public.sale_return_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sale_returns r
    WHERE r.id = sale_return_items.return_id
      AND public.has_shop_role(auth.uid(), r.shop_id, ARRAY['owner'::shop_role,'manager'::shop_role])
  ));

-- Trigger: restore stock when return item is added
CREATE OR REPLACE FUNCTION public.restore_stock_on_return()
RETURNS TRIGGER
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

CREATE TRIGGER trg_restore_stock_on_return
  AFTER INSERT ON public.sale_return_items
  FOR EACH ROW
  EXECUTE FUNCTION public.restore_stock_on_return();

-- Allow expenses UPDATE/DELETE policies already exist; allow purchases header UPDATE
CREATE POLICY "Owners/managers update purchase header"
  ON public.purchases FOR UPDATE
  USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]));