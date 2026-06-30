-- Cascade-delete a shop and all of its dependent data (super admin only)
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

  -- children of sales/returns/purchases first
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

  DELETE FROM public.payment_requests WHERE shop_id = _shop_id;
  DELETE FROM public.shop_members WHERE shop_id = _shop_id;

  -- best-effort: remove uploaded logo files for this shop
  BEGIN
    DELETE FROM storage.objects
      WHERE bucket_id = 'shop-logos'
        AND name LIKE _shop_id::text || '/%';
  EXCEPTION WHEN OTHERS THEN
    -- ignore storage cleanup failures
    NULL;
  END;

  DELETE FROM public.shops WHERE id = _shop_id;
END;
$$;

-- Cascade-delete a user, all owned shops, and remove memberships (super admin only)
CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_shop_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  -- delete every shop the user owns (membership-owner OR shops.created_by)
  FOR v_shop_id IN
    SELECT DISTINCT s.id
    FROM public.shops s
    LEFT JOIN public.shop_members sm
      ON sm.shop_id = s.id AND sm.user_id = _user_id AND sm.role = 'owner'
    WHERE s.created_by = _user_id OR sm.id IS NOT NULL
  LOOP
    PERFORM public.admin_delete_shop(v_shop_id);
  END LOOP;

  -- remove non-owner memberships left over
  DELETE FROM public.shop_members WHERE user_id = _user_id;

  -- roles, profile
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.profiles WHERE user_id = _user_id;

  -- finally remove the auth user
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;