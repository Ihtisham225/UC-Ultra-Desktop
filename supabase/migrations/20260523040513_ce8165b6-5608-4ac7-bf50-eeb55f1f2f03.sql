-- Drop the admin payments listing function (no longer needed)
DROP FUNCTION IF EXISTS public.admin_list_payments();

-- Drop the payment_requests table (cascades any dependent objects)
DROP TABLE IF EXISTS public.payment_requests CASCADE;

-- Recreate admin_overview_stats without payment_requests references
CREATE OR REPLACE FUNCTION public.admin_overview_stats()
RETURNS TABLE (
  total_users BIGINT,
  total_shops BIGINT,
  pro_shops BIGINT,
  total_sales BIGINT,
  pending_payments BIGINT,
  total_revenue NUMERIC
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM auth.users)::BIGINT,
    (SELECT COUNT(*) FROM public.shops)::BIGINT,
    (SELECT COUNT(*) FROM public.shops WHERE is_pro = true AND (pro_until IS NULL OR pro_until > now()))::BIGINT,
    (SELECT COUNT(*) FROM public.sales)::BIGINT,
    0::BIGINT,
    COALESCE((SELECT SUM(total) FROM public.sales), 0)::NUMERIC;
END;
$$;

-- Recreate admin_delete_shop without the payment_requests delete
CREATE OR REPLACE FUNCTION public.admin_delete_shop(_shop_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.sale_return_items
    WHERE return_id IN (SELECT id FROM public.sale_returns WHERE shop_id = _shop_id);
  DELETE FROM public.sale_returns WHERE shop_id = _shop_id;

  DELETE FROM public.sale_items
    WHERE sale_id IN (SELECT id FROM public.sales WHERE shop_id = _shop_id);
  DELETE FROM public.sale_notifications WHERE shop_id = _shop_id;
  DELETE FROM public.sales WHERE shop_id = _shop_id;

  DELETE FROM public.purchase_items
    WHERE purchase_id IN (SELECT id FROM public.purchases WHERE shop_id = _shop_id);
  DELETE FROM public.purchases WHERE shop_id = _shop_id;

  DELETE FROM public.expenses WHERE shop_id = _shop_id;
  DELETE FROM public.expense_categories WHERE shop_id = _shop_id;

  DELETE FROM public.products WHERE shop_id = _shop_id;
  DELETE FROM public.customers WHERE shop_id = _shop_id;
  DELETE FROM public.suppliers WHERE shop_id = _shop_id;

  DELETE FROM public.shop_members WHERE shop_id = _shop_id;

  BEGIN
    DELETE FROM storage.objects
      WHERE bucket_id = 'shop-logos'
        AND name LIKE _shop_id::text || '/%';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  DELETE FROM public.shops WHERE id = _shop_id;
END;
$$;