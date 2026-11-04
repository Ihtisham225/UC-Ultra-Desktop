/**
 * Shapes shared by the Production screen and its actions (cafe batches).
 * ⚠️ COPIED verbatim to the desktop, whose screen calls the same actions over RPC.
 * Types only — `export type` re-exports from a "use server" file break it.
 */

export interface ProductionIngredientDto {
  id: string;
  name: string;
  unit: string | null;
  stock: number;
  /** Average landed cost per stock unit; null when never bought. */
  cost: number | null;
  is_active: boolean;
}

export interface BatchProductDto {
  id: string;
  name: string;
  unit: string | null;
  stock: number;
  recipe_yield: number;
  /** Empty for a no-recipe cafe's "prepared ahead" item: the batch is costed at current_cost instead. */
  recipe_lines: { ingredient_id: string; quantity: number; unit: string }[];
  /** What one costs to make, typed on the product (products.current_cost). */
  current_cost?: number | null;
}

export interface ProductionRunDto {
  id: string;
  product_id: string;
  product_name: string;
  unit: string | null;
  quantity: number;
  run_date: string;
  total_cost: number;
  /** total_cost / quantity. */
  unit_cost: number;
  notes: string | null;
  created_at: string;
  items: { product_id: string; product_name: string; unit: string | null; quantity: number; unit_cost: number }[];
}

/** What each app plugs into the shared screen (server actions / RPC). */
export interface ProductionApi {
  formData: () => Promise<{ products: BatchProductDto[]; ingredients: ProductionIngredientDto[] }>;
  list: (opts: { from: string; to: string }) => Promise<ProductionRunDto[]>;
  create: (input: {
    product_id: string;
    quantity: number;
    run_date: string;
    notes?: string | null;
    /** Empty when the product has no recipe — then `unit_cost` prices the batch. */
    items: { product_id: string; quantity: number }[];
    unit_cost?: number | null;
  }) => Promise<{ ok: boolean; id?: string; error?: string }>;
  remove: (id: string) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * Production runs as cost lines, shaped like purchase_items: a batch's cost is
 * what its ingredients cost when it was made, so the P&L (lib/pnl) costs a
 * batch-made item exactly as it costs a bought one. Rows may be synced (text
 * Decimals) or typed.
 */
export function productionCostLinesOf(
  runs: { product_id: string; quantity: number | string; total_cost: number | string }[],
): { product_id: string; variant_id: null; quantity: number; unit_cost: number; expense_amount: number }[] {
  return runs
    .filter((r) => Number(r.quantity) > 0)
    .map((r) => ({
      product_id: r.product_id,
      variant_id: null,
      quantity: Number(r.quantity),
      unit_cost: Number(r.total_cost) / Number(r.quantity),
      expense_amount: 0,
    }));
}

/**
 * A service with a typed cost (a no-recipe cafe's "made on the spot" item:
 * one cup of tea costs 35) as a single cost line, so the P&L costs every cup
 * sold at that figure instead of counting the whole price as profit. Services
 * without a cost (lab tests, labour) give nothing and stay costless, as before.
 */
export function typedCostLinesOf(
  products: { id: string; is_service?: boolean | null; current_cost?: number | string | null }[],
): { product_id: string; variant_id: null; quantity: number; unit_cost: number; expense_amount: number }[] {
  return products
    .filter((p) => p.is_service && Number(p.current_cost) > 0)
    .map((p) => ({ product_id: p.id, variant_id: null, quantity: 1, unit_cost: Number(p.current_cost), expense_amount: 0 }));
}
