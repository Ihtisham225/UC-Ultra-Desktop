CREATE OR REPLACE FUNCTION public.replace_purchase_items(
  _purchase_id uuid,
  _supplier_id uuid,
  _reference_number text,
  _payment_method payment_method,
  _notes text,
  _items jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
  v_subtotal numeric := 0;
  v_item jsonb;
BEGIN
  SELECT shop_id INTO v_shop_id FROM public.purchases WHERE id = _purchase_id;
  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Purchase not found';
  END IF;
  IF NOT public.has_shop_role(auth.uid(), v_shop_id, ARRAY['owner'::shop_role, 'manager'::shop_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Reverse current stock by deleting items (trigger handles stock reversal)
  DELETE FROM public.purchase_items WHERE purchase_id = _purchase_id;

  -- Insert new items (trigger re-applies stock)
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    INSERT INTO public.purchase_items(
      purchase_id, product_id, variant_id, product_name, unit_cost, quantity, line_total
    ) VALUES (
      _purchase_id,
      NULLIF(v_item->>'product_id','')::uuid,
      NULLIF(v_item->>'variant_id','')::uuid,
      v_item->>'product_name',
      (v_item->>'unit_cost')::numeric,
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_cost')::numeric * (v_item->>'quantity')::numeric
    );
    v_subtotal := v_subtotal + (v_item->>'unit_cost')::numeric * (v_item->>'quantity')::numeric;
  END LOOP;

  UPDATE public.purchases
  SET supplier_id = _supplier_id,
      reference_number = _reference_number,
      payment_method = _payment_method,
      notes = _notes,
      subtotal = v_subtotal,
      tax = 0,
      total = v_subtotal,
      paid_amount = v_subtotal
  WHERE id = _purchase_id;
END;
$$;