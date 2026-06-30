-- Add paid_amount column to debts to track cumulative settled amount
ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;

-- Create debt_payments table
CREATE TABLE IF NOT EXISTS public.debt_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id uuid NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id ON public.debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_shop_id ON public.debt_payments(shop_id);

ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view debt payments"
  ON public.debt_payments FOR SELECT
  USING (public.is_shop_member(auth.uid(), shop_id));

CREATE POLICY "Owners/managers create debt payments"
  ON public.debt_payments FOR INSERT
  WITH CHECK (
    public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role, 'manager'::shop_role])
    AND auth.uid() = created_by
  );

CREATE POLICY "Owners/managers update debt payments"
  ON public.debt_payments FOR UPDATE
  USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role, 'manager'::shop_role]));

CREATE POLICY "Owners/managers delete debt payments"
  ON public.debt_payments FOR DELETE
  USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role, 'manager'::shop_role]));

-- Trigger function: recalc paid_amount and status on debt after payment changes
CREATE OR REPLACE FUNCTION public.recalc_debt_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debt_id uuid;
  v_total_paid numeric;
  v_amount numeric;
BEGIN
  v_debt_id := COALESCE(NEW.debt_id, OLD.debt_id);

  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM public.debt_payments WHERE debt_id = v_debt_id;

  SELECT amount INTO v_amount FROM public.debts WHERE id = v_debt_id;

  UPDATE public.debts
    SET paid_amount = v_total_paid,
        status = CASE WHEN v_total_paid >= v_amount THEN 'settled'::debt_status ELSE 'open'::debt_status END,
        settled_at = CASE WHEN v_total_paid >= v_amount THEN COALESCE(settled_at, now()) ELSE NULL END,
        updated_at = now()
    WHERE id = v_debt_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_debt_payments_recalc_ins ON public.debt_payments;
CREATE TRIGGER trg_debt_payments_recalc_ins
  AFTER INSERT OR UPDATE OR DELETE ON public.debt_payments
  FOR EACH ROW EXECUTE FUNCTION public.recalc_debt_paid();