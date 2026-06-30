-- Overview KPIs
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
    (SELECT COUNT(*) FROM public.payment_requests WHERE status = 'pending')::BIGINT,
    COALESCE((SELECT SUM(amount) FROM public.payment_requests WHERE status IN ('approved','auto_verified')), 0)::NUMERIC;
END;
$$;

-- List users
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  is_super_admin BOOLEAN,
  shop_count BIGINT
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
    u.id,
    u.email::TEXT,
    p.display_name,
    u.created_at,
    u.last_sign_in_at,
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'super_admin'),
    (SELECT COUNT(*) FROM public.shop_members sm WHERE sm.user_id = u.id AND sm.role = 'owner')::BIGINT
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

-- List shops
CREATE OR REPLACE FUNCTION public.admin_list_shops()
RETURNS TABLE (
  shop_id UUID,
  name TEXT,
  currency TEXT,
  is_pro BOOLEAN,
  pro_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  owner_email TEXT,
  member_count BIGINT,
  sales_count BIGINT,
  sales_total NUMERIC
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
    s.id,
    s.name,
    s.currency,
    s.is_pro,
    s.pro_until,
    s.created_at,
    u.email::TEXT,
    (SELECT COUNT(*) FROM public.shop_members sm WHERE sm.shop_id = s.id)::BIGINT,
    (SELECT COUNT(*) FROM public.sales sa WHERE sa.shop_id = s.id)::BIGINT,
    COALESCE((SELECT SUM(total) FROM public.sales sa WHERE sa.shop_id = s.id), 0)::NUMERIC
  FROM public.shops s
  LEFT JOIN auth.users u ON u.id = s.created_by
  ORDER BY s.created_at DESC;
END;
$$;

-- List all payment requests w/ shop & plan info
CREATE OR REPLACE FUNCTION public.admin_list_payments()
RETURNS TABLE (
  request_id UUID,
  shop_id UUID,
  shop_name TEXT,
  plan_name TEXT,
  amount NUMERIC,
  currency TEXT,
  status TEXT,
  easypaisa_txn_id TEXT,
  payer_msisdn TEXT,
  created_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reject_reason TEXT,
  payer_email TEXT
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
    pr.id,
    pr.shop_id,
    s.name,
    pl.name,
    pr.amount,
    pr.currency,
    pr.status::TEXT,
    pr.easypaisa_txn_id,
    pr.payer_msisdn,
    pr.created_at,
    pr.reviewed_at,
    pr.reject_reason,
    u.email::TEXT
  FROM public.payment_requests pr
  LEFT JOIN public.shops s ON s.id = pr.shop_id
  LEFT JOIN public.plans pl ON pl.id = pr.plan_id
  LEFT JOIN auth.users u ON u.id = pr.created_by
  ORDER BY pr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_overview_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_shops() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_payments() TO authenticated;