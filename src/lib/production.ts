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
  recipe_lines: { ingredient_id: string; quantity: number; unit: string }[];
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
    items: { product_id: string; quantity: number }[];
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
