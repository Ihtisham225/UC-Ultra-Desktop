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
