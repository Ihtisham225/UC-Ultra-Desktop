
-- ============== ENUMS ==============
DO $$ BEGIN
  CREATE TYPE public.app_module AS ENUM (
    'pos','products','sales','customers','suppliers','purchases','returns','expenses','debts','analytics','staff','settings'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.permission_action AS ENUM ('view','create','edit','delete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============== COLUMN ADDITIONS ==============
ALTER TABLE public.shop_members
  ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- ============== ROLES TABLES ==============
CREATE TABLE IF NOT EXISTS public.shop_custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, name)
);
ALTER TABLE public.shop_custom_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.shop_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.shop_custom_roles(id) ON DELETE CASCADE,
  module public.app_module NOT NULL,
  action public.permission_action NOT NULL,
  UNIQUE (role_id, module, action)
);
ALTER TABLE public.shop_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.shop_user_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role_id UUID NOT NULL REFERENCES public.shop_custom_roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, user_id)
);
ALTER TABLE public.shop_user_role_assignments ENABLE ROW LEVEL SECURITY;

-- ============== HELPER ==============
CREATE OR REPLACE FUNCTION public.has_shop_permission(_uid UUID, _shop_id UUID, _module public.app_module, _action public.permission_action)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_shop_role(_uid, _shop_id, ARRAY['owner'::shop_role])
    OR EXISTS (
      SELECT 1
      FROM public.shop_user_role_assignments ura
      JOIN public.shop_role_permissions rp ON rp.role_id = ura.role_id
      WHERE ura.user_id = _uid
        AND ura.shop_id = _shop_id
        AND rp.module = _module
        AND rp.action = _action
    );
$$;

-- ============== RLS POLICIES ==============
DROP POLICY IF EXISTS "Members view custom roles" ON public.shop_custom_roles;
CREATE POLICY "Members view custom roles" ON public.shop_custom_roles
  FOR SELECT USING (public.is_shop_member(auth.uid(), shop_id));
DROP POLICY IF EXISTS "Owners/managers manage custom roles ins" ON public.shop_custom_roles;
CREATE POLICY "Owners/managers manage custom roles ins" ON public.shop_custom_roles
  FOR INSERT WITH CHECK (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]));
DROP POLICY IF EXISTS "Owners/managers manage custom roles upd" ON public.shop_custom_roles;
CREATE POLICY "Owners/managers manage custom roles upd" ON public.shop_custom_roles
  FOR UPDATE USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]));
DROP POLICY IF EXISTS "Owners/managers manage custom roles del" ON public.shop_custom_roles;
CREATE POLICY "Owners/managers manage custom roles del" ON public.shop_custom_roles
  FOR DELETE USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]));

DROP POLICY IF EXISTS "Members view role permissions" ON public.shop_role_permissions;
CREATE POLICY "Members view role permissions" ON public.shop_role_permissions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.shop_custom_roles r WHERE r.id = role_id AND public.is_shop_member(auth.uid(), r.shop_id)));
DROP POLICY IF EXISTS "Owners/managers manage role permissions ins" ON public.shop_role_permissions;
CREATE POLICY "Owners/managers manage role permissions ins" ON public.shop_role_permissions
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.shop_custom_roles r WHERE r.id = role_id AND public.has_shop_role(auth.uid(), r.shop_id, ARRAY['owner'::shop_role,'manager'::shop_role])));
DROP POLICY IF EXISTS "Owners/managers manage role permissions del" ON public.shop_role_permissions;
CREATE POLICY "Owners/managers manage role permissions del" ON public.shop_role_permissions
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.shop_custom_roles r WHERE r.id = role_id AND public.has_shop_role(auth.uid(), r.shop_id, ARRAY['owner'::shop_role,'manager'::shop_role])));

DROP POLICY IF EXISTS "Members view role assignments" ON public.shop_user_role_assignments;
CREATE POLICY "Members view role assignments" ON public.shop_user_role_assignments
  FOR SELECT USING (public.is_shop_member(auth.uid(), shop_id));
DROP POLICY IF EXISTS "Owners/managers manage role assignments ins" ON public.shop_user_role_assignments;
CREATE POLICY "Owners/managers manage role assignments ins" ON public.shop_user_role_assignments
  FOR INSERT WITH CHECK (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]));
DROP POLICY IF EXISTS "Owners/managers manage role assignments upd" ON public.shop_user_role_assignments;
CREATE POLICY "Owners/managers manage role assignments upd" ON public.shop_user_role_assignments
  FOR UPDATE USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]));
DROP POLICY IF EXISTS "Owners/managers manage role assignments del" ON public.shop_user_role_assignments;
CREATE POLICY "Owners/managers manage role assignments del" ON public.shop_user_role_assignments
  FOR DELETE USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]));

-- ============== SEED FUNCTION ==============
CREATE OR REPLACE FUNCTION public.seed_default_shop_roles_for(_shop_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_manager_id UUID;
  v_cashier_id UUID;
  m public.app_module;
  a public.permission_action;
BEGIN
  -- Manager: full access
  INSERT INTO public.shop_custom_roles(shop_id, name, is_system)
  VALUES (_shop_id, 'Manager', true)
  ON CONFLICT (shop_id, name) DO UPDATE SET is_system = true
  RETURNING id INTO v_manager_id;

  IF v_manager_id IS NULL THEN
    SELECT id INTO v_manager_id FROM public.shop_custom_roles WHERE shop_id = _shop_id AND name = 'Manager';
  END IF;

  FOR m IN SELECT unnest(enum_range(NULL::public.app_module)) LOOP
    FOR a IN SELECT unnest(enum_range(NULL::public.permission_action)) LOOP
      INSERT INTO public.shop_role_permissions(role_id, module, action)
      VALUES (v_manager_id, m, a)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- Cashier: POS, Sales view+create, Products view, Customers view+create
  INSERT INTO public.shop_custom_roles(shop_id, name, is_system)
  VALUES (_shop_id, 'Cashier', true)
  ON CONFLICT (shop_id, name) DO UPDATE SET is_system = true
  RETURNING id INTO v_cashier_id;

  IF v_cashier_id IS NULL THEN
    SELECT id INTO v_cashier_id FROM public.shop_custom_roles WHERE shop_id = _shop_id AND name = 'Cashier';
  END IF;

  -- POS full
  FOR a IN SELECT unnest(enum_range(NULL::public.permission_action)) LOOP
    INSERT INTO public.shop_role_permissions(role_id, module, action) VALUES (v_cashier_id, 'pos', a) ON CONFLICT DO NOTHING;
  END LOOP;
  INSERT INTO public.shop_role_permissions(role_id, module, action) VALUES
    (v_cashier_id, 'sales', 'view'), (v_cashier_id, 'sales', 'create'),
    (v_cashier_id, 'products', 'view'),
    (v_cashier_id, 'customers', 'view'), (v_cashier_id, 'customers', 'create')
  ON CONFLICT DO NOTHING;
END $$;

-- Seed all existing shops
DO $$
DECLARE s RECORD;
BEGIN
  FOR s IN SELECT id FROM public.shops LOOP
    PERFORM public.seed_default_shop_roles_for(s.id);
  END LOOP;
END $$;

-- Map existing managers/cashiers to seeded roles
INSERT INTO public.shop_user_role_assignments (shop_id, user_id, role_id)
SELECT sm.shop_id, sm.user_id, r.id
FROM public.shop_members sm
JOIN public.shop_custom_roles r ON r.shop_id = sm.shop_id
  AND ((sm.role = 'manager' AND r.name = 'Manager') OR (sm.role = 'cashier' AND r.name = 'Cashier'))
WHERE sm.role IN ('manager','cashier')
ON CONFLICT (shop_id, user_id) DO NOTHING;

-- Auto-seed roles when a new shop is created
CREATE OR REPLACE FUNCTION public.handle_new_shop_seed_roles()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_shop_roles_for(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_shops_seed_roles ON public.shops;
CREATE TRIGGER trg_shops_seed_roles
  AFTER INSERT ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_shop_seed_roles();
