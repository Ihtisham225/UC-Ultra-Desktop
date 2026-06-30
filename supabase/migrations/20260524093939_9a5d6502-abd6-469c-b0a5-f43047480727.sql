
-- 1) Make purchase-invoices bucket private and lock down storage policies
UPDATE storage.buckets SET public = false WHERE id = 'purchase-invoices';

-- Drop old permissive policies
DROP POLICY IF EXISTS "Public read purchase invoices" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload purchase invoices" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete purchase invoices" ON storage.objects;
DROP POLICY IF EXISTS "Shop members read purchase invoices" ON storage.objects;
DROP POLICY IF EXISTS "Shop members upload purchase invoices" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners delete purchase invoices" ON storage.objects;

-- Shop members can read files in their shop's folder (path: <shop_id>/...)
CREATE POLICY "Shop members read purchase invoices"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'purchase-invoices'
  AND public.is_shop_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Shop members upload purchase invoices"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'purchase-invoices'
  AND public.has_shop_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['owner'::shop_role,'manager'::shop_role])
);

CREATE POLICY "Shop owners delete purchase invoices"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'purchase-invoices'
  AND public.has_shop_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['owner'::shop_role,'manager'::shop_role])
);

-- 2) Restrict payments SELECT to owners/managers only (was: any shop member)
DROP POLICY IF EXISTS "Members view shop payments" ON public.payments;
CREATE POLICY "Owners/managers view shop payments"
ON public.payments FOR SELECT
USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]));

-- 3) Restrict sale_notifications INSERT to owners/managers (was: any shop member)
DROP POLICY IF EXISTS "Members create sale notifications" ON public.sale_notifications;
CREATE POLICY "Owners/managers create sale notifications"
ON public.sale_notifications FOR INSERT TO authenticated
WITH CHECK (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role,'manager'::shop_role]));
