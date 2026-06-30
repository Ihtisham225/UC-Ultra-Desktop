-- Owner-only delete for a sale: removes sale_items, sale_notifications, sale_returns (+ their items), then the sale itself
CREATE OR REPLACE FUNCTION public.delete_sale(_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
BEGIN
  SELECT shop_id INTO v_shop_id FROM public.sales WHERE id = _sale_id;
  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;
  IF NOT public.has_shop_role(auth.uid(), v_shop_id, ARRAY['owner'::shop_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.sale_return_items
    WHERE return_id IN (SELECT id FROM public.sale_returns WHERE sale_id = _sale_id);
  DELETE FROM public.sale_returns WHERE sale_id = _sale_id;
  DELETE FROM public.sale_notifications WHERE sale_id = _sale_id;
  DELETE FROM public.sale_items WHERE sale_id = _sale_id;
  DELETE FROM public.sales WHERE id = _sale_id;
END;
$$;

-- Owner-only delete for a purchase: removes purchase_items, then the purchase itself
CREATE OR REPLACE FUNCTION public.delete_purchase(_purchase_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
BEGIN
  SELECT shop_id INTO v_shop_id FROM public.purchases WHERE id = _purchase_id;
  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Purchase not found';
  END IF;
  IF NOT public.has_shop_role(auth.uid(), v_shop_id, ARRAY['owner'::shop_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.purchase_items WHERE purchase_id = _purchase_id;
  DELETE FROM public.purchases WHERE id = _purchase_id;
END;
$$;

-- Owner-only delete for a return: removes sale_return_items, then the return itself
CREATE OR REPLACE FUNCTION public.delete_sale_return(_return_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
BEGIN
  SELECT shop_id INTO v_shop_id FROM public.sale_returns WHERE id = _return_id;
  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Return not found';
  END IF;
  IF NOT public.has_shop_role(auth.uid(), v_shop_id, ARRAY['owner'::shop_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.sale_return_items WHERE return_id = _return_id;
  DELETE FROM public.sale_returns WHERE id = _return_id;
END;
$$;