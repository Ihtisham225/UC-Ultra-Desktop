/**
 * Typing a till line's amount. Which side gives way depends on how the goods
 * are sold (amountSetsQuantity):
 *
 * - **Weighed or measured** (kg, g, L, ml): "Rs 1000 of milk" buys a quantity
 *   at the shop's rate — 1000 ÷ Rs 220/kg is 4.55 kg, and THAT is what leaves
 *   stock (qtyForAmount). Keeping the quantity here sold Rs 1000 of milk as
 *   1 kg at Rs 1000/kg and took 1 kg off the shelf (Daily Cup, 2026-11-14).
 * - **Counted** (pcs, or the shop's own word like "Packet"): the quantity the
 *   counter entered is what left the shelf, so it stays put and the PRICE per
 *   item follows: 24 kheer for Rs 1000 is 24 at Rs 41.67, not 25 at Rs 40
 *   (priceForAmount).
 *
 * Typing the quantity keeps the price and the amount follows, as before.
 *
 * ⚠️ `sale_items.unit_price` is stored to 2 places, so 1000 ÷ 24 (41.666…) is
 * saved as 41.67 — and 41.67 × 24 is Rs 1000.08, not the Rs 1000 the customer
 * handed over. The typed amount therefore travels with the line as its total,
 * and is believed only while it agrees with price × quantity to within that
 * rounding; anything further off is a stale amount (the price or quantity was
 * changed after it was typed) and price × quantity wins.
 *
 * Pure and COPIED verbatim to the desktop (pinned by src/test/sell-by-amount.test.ts).
 */

import { unitDimension } from "./units";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** True when the line's unit is a weight or a volume: the amount then sets the quantity, not the price. */
export function amountSetsQuantity(unit: string | null | undefined): boolean {
  const d = unitDimension(unit);
  return d === "mass" || d === "volume";
}

/** The quantity `amount` buys at `unitPrice`, to the 2 places a sale line stores. Null when it can't be worked out. */
export function qtyForAmount(amount: number, unitPrice: number): number | null {
  if (!(amount > 0) || !(unitPrice > 0)) return null;
  const q = round2(amount / unitPrice);
  return q > 0 ? q : null;
}

/** The price per item that makes `quantity` cost `amount`, to the 2 places a sale line stores. Null when it can't be worked out. */
export function priceForAmount(amount: number, quantity: number): number | null {
  if (!(amount > 0) || !(quantity > 0)) return null;
  const p = round2(amount / quantity);
  return p > 0 ? p : null;
}

/** A line's total: the typed amount when it still fits price × quantity, else price × quantity. */
export function lineTotalOf(unitPrice: number, quantity: number, amount?: number | null): number {
  const computed = round2(unitPrice * quantity);
  if (amount == null || !(amount > 0)) return computed;
  // Price and quantity are each rounded to the nearest 0.01, so price ×
  // quantity can be off the real amount by up to half a hundredth of the other
  // one: of the quantity when the price was worked out (24 at 41.67), of the
  // price when the quantity was.
  const slack = (unitPrice + quantity) * 0.005 + 0.005;
  return Math.abs(amount - unitPrice * quantity) <= slack ? round2(amount) : computed;
}
