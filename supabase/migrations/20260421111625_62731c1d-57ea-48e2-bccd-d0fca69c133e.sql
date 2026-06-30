CREATE POLICY "Shop members view co-member profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.shop_members me
    JOIN public.shop_members them ON them.shop_id = me.shop_id
    WHERE me.user_id = auth.uid()
      AND them.user_id = profiles.user_id
  )
);