-- Attach trigger so the shop creator becomes owner automatically
DROP TRIGGER IF EXISTS on_shop_created ON public.shops;
CREATE TRIGGER on_shop_created
AFTER INSERT ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.handle_new_shop();

-- Attach stock decrement trigger on sale_items
DROP TRIGGER IF EXISTS trg_decrement_stock ON public.sale_items;
CREATE TRIGGER trg_decrement_stock
AFTER INSERT ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_sale();

-- Attach updated_at triggers
DROP TRIGGER IF EXISTS update_shops_updated_at ON public.shops;
CREATE TRIGGER update_shops_updated_at
BEFORE UPDATE ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();