ALTER TABLE public.supplier_returns
  ADD CONSTRAINT supplier_returns_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE CASCADE,
  ADD CONSTRAINT supplier_returns_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;