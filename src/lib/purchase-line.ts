/**
 * Typing a purchase line's total works the quantity out of it — a supplier's
 * bill often says "Rs 750 of milk", not how many litres. COPIED verbatim to the
 * desktop; keep the two in step.
 *
 * The total is what the Line total column shows: goods plus that line's own
 * expenses, so the expenses come off before dividing by the unit cost.
 * `purchase_items.quantity` holds 2 decimals, so the quantity is rounded to
 * that — the line total then reads the nearest amount that quantity makes
 * (Rs 750 at 230 → 3.26 → Rs 749.80).
 *
 * Returns null when no quantity can be worked out (no unit cost yet, or a
 * total that doesn't even cover the expenses).
 */
export function quantityForLineTotal(
  total: number,
  unitCost: number | null | undefined,
  expenses: number | null | undefined,
): number | null {
  const cost = Number(unitCost);
  if (!Number.isFinite(total) || !Number.isFinite(cost) || cost <= 0) return null;
  const goods = total - (Number(expenses) || 0);
  if (goods <= 0) return null;
  const qty = Math.round((goods / cost) * 100) / 100;
  return qty > 0 ? qty : null;
}

/**
 * The goods value to store for a line: the total the person typed, when they
 * typed one, otherwise unit cost × quantity.
 *
 * A typed total is kept only while it is what that unit cost and quantity
 * could actually make — within half a step of the rounded quantity (Rs 740 at
 * 230 is 3.2174, stored as 3.22, which × 230 is Rs 740.60). Anything further
 * off is a stale or mistyped figure, and the arithmetic wins.
 */
export function lineGoodsTotal(
  unitCost: number,
  quantity: number,
  typed?: number | null,
): number {
  const computed = Math.round(unitCost * quantity * 100) / 100;
  if (typed == null || !Number.isFinite(typed)) return computed;
  const slack = Math.abs(unitCost) * 0.005 + 0.005;
  return Math.abs(typed - unitCost * quantity) <= slack ? Math.round(typed * 100) / 100 : computed;
}

/**
 * What a stored purchase line's goods cost — its line_total when the row
 * carries one (a typed total is the bill's real figure), else unit cost ×
 * quantity. Every landed-cost figure reads it, so the P&L, the markup form and
 * the purchase itself agree on what was paid.
 */
export function storedLineGoods(l: {
  quantity: number | string | null | undefined;
  unit_cost: number | string | null | undefined;
  line_total?: number | string | null;
}): number {
  const lt = l.line_total == null ? NaN : Number(l.line_total);
  if (Number.isFinite(lt)) return lt;
  return (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0);
}
