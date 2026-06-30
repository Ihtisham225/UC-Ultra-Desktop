DROP POLICY IF EXISTS "Members view their shops" ON public.shops;

CREATE POLICY "Members and creators view their shops"
ON public.shops
FOR SELECT
TO authenticated
USING (
  public.is_shop_member(auth.uid(), id)
  OR created_by = auth.uid()
);