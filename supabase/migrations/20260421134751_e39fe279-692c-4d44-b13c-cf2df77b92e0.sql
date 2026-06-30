
-- =========================================================
-- 1. shop_members: prevent privilege escalation
-- =========================================================

-- Drop overly permissive UPDATE/DELETE/INSERT policies
DROP POLICY IF EXISTS "Owners/managers update members" ON public.shop_members;
DROP POLICY IF EXISTS "Owners/managers remove members" ON public.shop_members;
DROP POLICY IF EXISTS "Owners/managers add members" ON public.shop_members;

-- INSERT: managers can add cashier/manager only; owners can add anything.
-- Cannot add another owner unless you are an owner.
CREATE POLICY "Add members with role guard"
ON public.shop_members
FOR INSERT
TO authenticated
WITH CHECK (
  (
    public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role])
  )
  OR
  (
    public.has_shop_role(auth.uid(), shop_id, ARRAY['manager'::shop_role])
    AND role <> 'owner'::shop_role
  )
);

-- UPDATE: only owners can change roles, and never their own row
CREATE POLICY "Only owners update members"
ON public.shop_members
FOR UPDATE
TO authenticated
USING (
  public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role])
  AND user_id <> auth.uid()
)
WITH CHECK (
  public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role])
  AND user_id <> auth.uid()
);

-- DELETE: only owners can remove other members; cannot remove themselves
CREATE POLICY "Only owners remove members"
ON public.shop_members
FOR DELETE
TO authenticated
USING (
  public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role])
  AND user_id <> auth.uid()
);

-- =========================================================
-- 2. sale_notifications: restrict to owners/managers
-- =========================================================

DROP POLICY IF EXISTS "Members view sale notifications" ON public.sale_notifications;
DROP POLICY IF EXISTS "Members create sale notifications" ON public.sale_notifications;

CREATE POLICY "Owners/managers view sale notifications"
ON public.sale_notifications
FOR SELECT
TO authenticated
USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role, 'manager'::shop_role]));

CREATE POLICY "Members create sale notifications"
ON public.sale_notifications
FOR INSERT
TO authenticated
WITH CHECK (public.is_shop_member(auth.uid(), shop_id));

-- =========================================================
-- 3. shop-logos storage policies
-- =========================================================

-- Drop any pre-existing object policies for this bucket (idempotent best-effort)
DROP POLICY IF EXISTS "Public read shop logos" ON storage.objects;
DROP POLICY IF EXISTS "Shop staff upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Shop staff update logos" ON storage.objects;
DROP POLICY IF EXISTS "Shop staff delete logos" ON storage.objects;

-- Public can read individual files by direct URL (bucket already public),
-- but listing all files requires the policy below — scoped to direct path access.
CREATE POLICY "Public read shop logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'shop-logos');

-- Only shop owners/managers can upload to a folder named after their shop_id
CREATE POLICY "Shop staff upload logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'shop-logos'
  AND (
    (storage.foldername(name))[1] IS NOT NULL
    AND public.has_shop_role(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      ARRAY['owner'::shop_role, 'manager'::shop_role]
    )
  )
);

CREATE POLICY "Shop staff update logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'shop-logos'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.has_shop_role(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid,
    ARRAY['owner'::shop_role, 'manager'::shop_role]
  )
);

CREATE POLICY "Shop staff delete logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'shop-logos'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.has_shop_role(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid,
    ARRAY['owner'::shop_role, 'manager'::shop_role]
  )
);
