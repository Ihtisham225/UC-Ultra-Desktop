
-- Extend shops with branding/contact fields
ALTER TABLE public.shops 
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS receipt_header text,
  ADD COLUMN IF NOT EXISTS show_tax_line boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_low_stock boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_daily_summary boolean NOT NULL DEFAULT false;

-- Storage bucket for shop logos (public)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('shop-logos', 'shop-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for logos
DO $$ BEGIN
  CREATE POLICY "Public can view shop logos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'shop-logos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Owners/managers can upload logos to their shop folder (folder = shop_id)
DO $$ BEGIN
  CREATE POLICY "Owners/managers upload shop logos"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'shop-logos' 
      AND has_shop_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['owner'::shop_role, 'manager'::shop_role])
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners/managers update shop logos"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'shop-logos' 
      AND has_shop_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['owner'::shop_role, 'manager'::shop_role])
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners/managers delete shop logos"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'shop-logos' 
      AND has_shop_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['owner'::shop_role, 'manager'::shop_role])
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
