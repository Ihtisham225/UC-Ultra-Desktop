-- Auto-grant 7-day free trial to newly created shops
CREATE OR REPLACE FUNCTION public.grant_trial_on_new_shop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_pro = false AND NEW.pro_until IS NULL THEN
    NEW.is_pro := true;
    NEW.pro_until := now() + interval '7 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_trial_on_new_shop ON public.shops;
CREATE TRIGGER trg_grant_trial_on_new_shop
BEFORE INSERT ON public.shops
FOR EACH ROW
EXECUTE FUNCTION public.grant_trial_on_new_shop();

-- Backfill: any existing shop that never had a subscription gets a 7-day trial starting now
UPDATE public.shops
SET is_pro = true,
    pro_until = now() + interval '7 days',
    updated_at = now()
WHERE is_pro = false AND pro_until IS NULL;