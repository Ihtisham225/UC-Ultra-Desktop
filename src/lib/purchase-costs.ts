/**
 * What a product cost the last two times it was bought, landed — the goods
 * plus the line's share of expenses (freight, loading…), per unit.
 *
 * Feeds the "price by markup %" product form: selling price = current cost ×
 * (1 + markup / 100), where the current cost is typed on the form and saved
 * on the product (products.current_cost).
 *
 * Pure — ⚠️ COPIED verbatim to the desktop app (which feeds it its offline
 * store; the web feeds it from productPurchaseCostsAction).
 */

export interface CostLine {
  quantity: number | string;
  unit_cost: number | string;
  expense_amount?: number | string | null;
  /** When the purchase was made (purchases.created_at). */
  at: string | Date;
}

export interface PurchaseCosts {
  latest: number | null;
  previous: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** (unit cost × qty + expenses) ÷ qty. Null for a line with no quantity. */
export function landedUnitCost(l: CostLine): number | null {
  const q = Number(l.quantity);
  if (!Number.isFinite(q) || q <= 0) return null;
  const goods = Number(l.unit_cost) * q;
  const extra = Number(l.expense_amount ?? 0) || 0;
  return round2((goods + extra) / q);
}

/**
 * The latest purchase's landed unit cost, and the one before it — an earlier
 * PURCHASE, so two lines of the same bill never count as "previous".
 */
export function purchaseCosts(lines: CostLine[]): PurchaseCosts {
  const dated = lines
    .map((l) => ({ cost: landedUnitCost(l), at: new Date(l.at).getTime() }))
    .filter((l): l is { cost: number; at: number } => l.cost !== null && Number.isFinite(l.at))
    .sort((a, b) => b.at - a.at);
  const latest = dated[0];
  if (!latest) return { latest: null, previous: null };
  const previous = dated.find((l) => l.at < latest.at);
  return { latest: latest.cost, previous: previous?.cost ?? null };
}

/** Selling price from a cost and a markup %. */
export function priceFromMarkup(cost: number, markup: number): number {
  return round2(cost * (1 + markup / 100));
}

/** The markup % a typed price works out to on a cost (null when it can't). */
export function markupFromPrice(cost: number, price: number): number | null {
  if (!(cost > 0) || !Number.isFinite(price)) return null;
  return round2(((price - cost) / cost) * 100);
}

/**
 * The cost the markup works from. `typed` is the form's Current cost box:
 * undefined while untouched, null once cleared. Untouched, it starts from the
 * cost saved on the product last time — kept even after newer purchases, by
 * design — and only falls back to the purchase history when nothing is saved.
 * The same fallback is what "Previously purchased at" shows.
 */
export function costBaseFor(
  typed: number | null | undefined,
  saved: number | null | undefined,
  costs: PurchaseCosts | null | undefined,
): number | null {
  if (typed !== undefined) return typed;
  return saved ?? costs?.latest ?? costs?.previous ?? null;
}
