-- ============== ENUMS ==============
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_request_status AS ENUM ('pending', 'approved', 'rejected', 'auto_verified');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============== USER ROLES ==============
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own role" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Super admins view all roles" ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins insert roles" ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins update roles" ON public.user_roles FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins delete roles" ON public.user_roles FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'));

-- ============== PLANS ==============
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PKR',
  duration_days INTEGER NOT NULL,
  savings_label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view plans" ON public.plans FOR SELECT
  TO authenticated USING (is_active = true);
CREATE POLICY "Super admins manage plans" ON public.plans FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.plans (code, name, price, currency, duration_days, savings_label, sort_order) VALUES
  ('monthly', 'Monthly', 1500, 'PKR', 30, NULL, 1),
  ('yearly',  'Yearly',  14400, 'PKR', 365, 'Save 20%', 2)
ON CONFLICT (code) DO NOTHING;

-- ============== PAYMENT REQUESTS ==============
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PKR',
  easypaisa_txn_id TEXT,
  payer_msisdn TEXT,
  status public.payment_request_status NOT NULL DEFAULT 'pending',
  provider_response JSONB,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  reject_reason TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payment_requests_shop ON public.payment_requests(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON public.payment_requests(status, created_at DESC);

CREATE POLICY "Shop owners/managers create requests" ON public.payment_requests FOR INSERT
  WITH CHECK (
    public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role, 'manager'::shop_role])
    AND auth.uid() = created_by
  );
CREATE POLICY "Shop owners/managers view requests" ON public.payment_requests FOR SELECT
  USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role, 'manager'::shop_role]));
CREATE POLICY "Super admins view all requests" ON public.payment_requests FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins update requests" ON public.payment_requests FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_payment_requests_updated_at
  BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== ACTIVATE PRO ON APPROVAL ==============
CREATE OR REPLACE FUNCTION public.activate_pro_on_approval()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_days INTEGER;
  v_base TIMESTAMPTZ;
BEGIN
  IF NEW.status IN ('approved', 'auto_verified')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT duration_days INTO v_days FROM public.plans WHERE id = NEW.plan_id;
    SELECT GREATEST(COALESCE(pro_until, now()), now()) INTO v_base
      FROM public.shops WHERE id = NEW.shop_id;
    UPDATE public.shops
      SET is_pro = true,
          pro_until = v_base + make_interval(days => v_days),
          updated_at = now()
      WHERE id = NEW.shop_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER activate_pro_after_approval
  AFTER UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.activate_pro_on_approval();