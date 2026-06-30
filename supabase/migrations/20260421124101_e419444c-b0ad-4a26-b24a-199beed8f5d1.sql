
CREATE OR REPLACE FUNCTION public.admin_set_shop_pro(_shop_id uuid, _is_pro boolean, _days integer DEFAULT 30)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _is_pro THEN
    UPDATE public.shops
       SET is_pro = true,
           pro_until = GREATEST(COALESCE(pro_until, now()), now()) + make_interval(days => COALESCE(_days, 30)),
           updated_at = now()
     WHERE id = _shop_id;
  ELSE
    UPDATE public.shops
       SET is_pro = false,
           pro_until = NULL,
           updated_at = now()
     WHERE id = _shop_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_blocked(_user_id uuid, _blocked boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _blocked THEN
    UPDATE auth.users SET banned_until = 'infinity'::timestamptz WHERE id = _user_id;
  ELSE
    UPDATE auth.users SET banned_until = NULL WHERE id = _user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_shop_pro(uuid, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_blocked(uuid, boolean) TO authenticated;
