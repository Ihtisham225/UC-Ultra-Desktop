DROP TRIGGER IF EXISTS trg_increment_stock_on_purchase ON public.purchase_items;
CREATE TRIGGER trg_increment_stock_on_purchase
AFTER INSERT ON public.purchase_items
FOR EACH ROW
EXECUTE FUNCTION public.increment_stock_on_purchase();