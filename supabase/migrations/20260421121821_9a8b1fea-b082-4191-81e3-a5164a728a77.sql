
DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(user_id uuid, email text, display_name text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, is_super_admin boolean, shop_count bigint, is_blocked boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
    (SELECT COUNT(*) FROM public.shop_members sm WHERE sm.user_id = u.id AND sm.role = 'owner')::BIGINT,
    (u.banned_until IS NOT NULL AND u.banned_until > now())
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;
