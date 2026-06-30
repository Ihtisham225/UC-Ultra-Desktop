-- 1) Remove duplicate triggers (each table had two identical AFTER INSERT triggers)
DROP TRIGGER IF EXISTS trg_increment_stock_on_purchase ON public.purchase_items;
DROP TRIGGER IF EXISTS trg_decrement_stock ON public.sale_items;

-- 2) Reverse stock when a purchase line is deleted
CREATE OR REPLACE FUNCTION public.reverse_stock_on_purchase_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.variant_id IS NOT NULL THEN
    UPDATE public.product_variants
    SET stock = stock - OLD.quantity
    WHERE id = OLD.variant_id;
  ELSIF OLD.product_id IS NOT NULL THEN
    UPDATE public.products
    SET stock = stock - OLD.quantity
    WHERE id = OLD.product_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS purchase_items_reverse_stock ON public.purchase_items;
CREATE TRIGGER purchase_items_reverse_stock
AFTER DELETE ON public.purchase_items
FOR EACH ROW EXECUTE FUNCTION public.reverse_stock_on_purchase_delete();

-- 3) Restore stock when a sale line is deleted (sale deleted → put items back)
CREATE OR REPLACE FUNCTION public.reverse_stock_on_sale_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.variant_id IS NOT NULL THEN
    UPDATE public.product_variants
    SET stock = stock + OLD.quantity
    WHERE id = OLD.variant_id;
  ELSIF OLD.product_id IS NOT NULL THEN
    UPDATE public.products
    SET stock = stock + OLD.quantity
    WHERE id = OLD.product_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS sale_items_reverse_stock ON public.sale_items;
CREATE TRIGGER sale_items_reverse_stock
AFTER DELETE ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.reverse_stock_on_sale_delete();

-- 4) Reverse the restore when a return line is deleted (undo refund's stock add)
CREATE OR REPLACE FUNCTION public.reverse_stock_on_return_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.variant_id IS NOT NULL THEN
    UPDATE public.product_variants
    SET stock = stock - OLD.quantity
    WHERE id = OLD.variant_id;
  ELSIF OLD.product_id IS NOT NULL THEN
    UPDATE public.products
    SET stock = stock - OLD.quantity
    WHERE id = OLD.product_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS sale_return_items_reverse_stock ON public.sale_return_items;
CREATE TRIGGER sale_return_items_reverse_stock
AFTER DELETE ON public.sale_return_items
FOR EACH ROW EXECUTE FUNCTION public.reverse_stock_on_return_delete();