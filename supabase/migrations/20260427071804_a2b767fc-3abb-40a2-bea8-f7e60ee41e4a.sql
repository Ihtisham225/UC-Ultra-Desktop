-- 1. Drop cost column from products
ALTER TABLE public.products DROP COLUMN IF EXISTS cost;

-- 2. Create product_variants table
CREATE TABLE public.product_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  price_override NUMERIC,
  stock NUMERIC NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX idx_product_variants_shop ON public.product_variants(shop_id);
CREATE INDEX idx_product_variants_barcode ON public.product_variants(barcode) WHERE barcode IS NOT NULL;

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view product variants"
  ON public.product_variants FOR SELECT
  USING (public.is_shop_member(auth.uid(), shop_id));

CREATE POLICY "Owners/managers create product variants"
  ON public.product_variants FOR INSERT
  WITH CHECK (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role, 'manager'::shop_role]));

CREATE POLICY "Owners/managers update product variants"
  ON public.product_variants FOR UPDATE
  USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role, 'manager'::shop_role]));

CREATE POLICY "Owners/managers delete product variants"
  ON public.product_variants FOR DELETE
  USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role, 'manager'::shop_role]));

CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Add variant_id to sale_items, purchase_items, sale_return_items
ALTER TABLE public.sale_items ADD COLUMN variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_items ADD COLUMN variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;
ALTER TABLE public.sale_return_items ADD COLUMN variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;

CREATE INDEX idx_sale_items_variant ON public.sale_items(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_purchase_items_variant ON public.purchase_items(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_sale_return_items_variant ON public.sale_return_items(variant_id) WHERE variant_id IS NOT NULL;

-- 4. Update stock triggers to be variant-aware

-- Sales: decrement stock on sale (variant if present, else product)
CREATE OR REPLACE FUNCTION public.decrement_stock_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.variant_id IS NOT NULL THEN
    UPDATE public.product_variants
    SET stock = stock - NEW.quantity
    WHERE id = NEW.variant_id;
  ELSIF NEW.product_id IS NOT NULL THEN
    UPDATE public.products
    SET stock = stock - NEW.quantity
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Purchases: increment stock
CREATE OR REPLACE FUNCTION public.increment_stock_on_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.variant_id IS NOT NULL THEN
    UPDATE public.product_variants
    SET stock = stock + NEW.quantity
    WHERE id = NEW.variant_id;
  ELSIF NEW.product_id IS NOT NULL THEN
    UPDATE public.products
    SET stock = stock + NEW.quantity
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Returns: restore stock
CREATE OR REPLACE FUNCTION public.restore_stock_on_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.variant_id IS NOT NULL THEN
    UPDATE public.product_variants
    SET stock = stock + NEW.quantity
    WHERE id = NEW.variant_id;
  ELSIF NEW.product_id IS NOT NULL THEN
    UPDATE public.products
    SET stock = stock + NEW.quantity
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$function$;