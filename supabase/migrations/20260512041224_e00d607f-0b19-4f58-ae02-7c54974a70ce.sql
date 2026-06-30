CREATE OR REPLACE FUNCTION public.recalc_debt_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_debt_id uuid;
  v_total_paid numeric;
  v_amount numeric;
  v_inc_delta numeric := 0;
BEGIN
  v_debt_id := COALESCE(NEW.debt_id, OLD.debt_id);

  -- Apply 'increase' entries as deltas to debts.amount
  IF TG_OP = 'INSERT' AND NEW.kind = 'increase' THEN
    v_inc_delta := NEW.amount;
  ELSIF TG_OP = 'DELETE' AND OLD.kind = 'increase' THEN
    v_inc_delta := -OLD.amount;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.kind = 'increase' THEN v_inc_delta := v_inc_delta - OLD.amount; END IF;
    IF NEW.kind = 'increase' THEN v_inc_delta := v_inc_delta + NEW.amount; END IF;
  END IF;

  IF v_inc_delta <> 0 THEN
    UPDATE public.debts SET amount = amount + v_inc_delta WHERE id = v_debt_id;
  END IF;

  -- Recompute paid from 'payment' entries only
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM public.debt_payments
    WHERE debt_id = v_debt_id AND kind = 'payment';

  SELECT amount INTO v_amount FROM public.debts WHERE id = v_debt_id;

  UPDATE public.debts
    SET paid_amount = v_total_paid,
        status = CASE WHEN v_total_paid >= v_amount THEN 'settled'::debt_status ELSE 'open'::debt_status END,
        settled_at = CASE WHEN v_total_paid >= v_amount THEN COALESCE(settled_at, now()) ELSE NULL END,
        updated_at = now()
    WHERE id = v_debt_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;