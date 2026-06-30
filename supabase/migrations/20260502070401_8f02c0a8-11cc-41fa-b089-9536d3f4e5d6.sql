-- Add invoice image column to purchases
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS invoice_image_url text;

-- Create storage bucket for purchase invoices (public for easy display)
INSERT INTO storage.buckets (id, name, public)
VALUES ('purchase-invoices', 'purchase-invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: anyone (public) can read; only authenticated shop members can write/update/delete via path prefix = shop_id
CREATE POLICY "Public read purchase invoices"
ON storage.objects FOR SELECT
USING (bucket_id = 'purchase-invoices');

CREATE POLICY "Shop members upload purchase invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'purchase-invoices'
  AND public.is_shop_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Shop owners/managers update purchase invoices"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'purchase-invoices'
  AND public.has_shop_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['owner'::shop_role, 'manager'::shop_role])
);

CREATE POLICY "Shop owners/managers delete purchase invoices"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'purchase-invoices'
  AND public.has_shop_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['owner'::shop_role, 'manager'::shop_role])
);