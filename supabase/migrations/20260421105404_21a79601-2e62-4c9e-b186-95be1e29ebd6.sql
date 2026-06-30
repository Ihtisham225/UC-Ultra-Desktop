ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS is_pro boolean NOT NULL DEFAULT false;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS pro_until timestamptz;