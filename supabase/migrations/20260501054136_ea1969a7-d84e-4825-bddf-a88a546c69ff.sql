
CREATE TYPE public.debt_direction AS ENUM ('owed_to_me', 'i_owe');
CREATE TYPE public.debt_status AS ENUM ('open', 'settled');

CREATE TABLE public.debts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id uuid NOT NULL,
  created_by uuid NOT NULL,
  direction public.debt_direction NOT NULL,
  person_name text NOT NULL,
  phone text,
  amount numeric NOT NULL DEFAULT 0,
  currency text,
  due_date date,
  status public.debt_status NOT NULL DEFAULT 'open',
  notes text,
  settled_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_debts_shop_id ON public.debts(shop_id);
CREATE INDEX idx_debts_status ON public.debts(shop_id, status);

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view debts"
ON public.debts FOR SELECT
USING (public.is_shop_member(auth.uid(), shop_id));

CREATE POLICY "Owners/managers create debts"
ON public.debts FOR INSERT
WITH CHECK (
  public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role, 'manager'::shop_role])
  AND auth.uid() = created_by
);

CREATE POLICY "Owners/managers update debts"
ON public.debts FOR UPDATE
USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role, 'manager'::shop_role]));

CREATE POLICY "Owners/managers delete debts"
ON public.debts FOR DELETE
USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role, 'manager'::shop_role]));

CREATE TRIGGER update_debts_updated_at
BEFORE UPDATE ON public.debts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
