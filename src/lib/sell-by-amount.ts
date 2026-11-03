/**
 * Selling by amount: "Rs 100 of the Rs 250/kg one". The counter types what the
 * customer wants to spend and the quantity is worked out (0.4 kg), or types the
 * quantity and the amount follows (1 kg → Rs 250).
 *
 * ⚠️ `sale_items.quantity` is stored to 2 places, so Rs 100 of a Rs 240/kg item
 * (0.41666… kg) is saved as 0.42 kg — and 0.42 × 240 is Rs 100.80, not the
 * Rs 100 the customer handed over. The typed amount therefore travels with the
 * line as its total, and is believed only while it agrees with price × quantity
 * to within that rounding; anything further off is a stale amount (the price or
 * quantity was changed after it was typed) and price × quantity wins.
 *
 * Pure and COPIED verbatim to the desktop (pinned by src/test/sell-by-amount.test.ts).
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The quantity `amount` buys at `unitPrice`, to the 2 places a sale line stores. Null when it can't be worked out. */
export function qtyForAmount(amount: number, unitPrice: number): number | null {
  if (!(amount > 0) || !(unitPrice > 0)) return null;
  const q = round2(amount / unitPrice);
  return q > 0 ? q : null;
}

/** A line's total: the typed amount when it still fits price × quantity, else price × quantity. */
export function lineTotalOf(unitPrice: number, quantity: number, amount?: number | null): number {
  const computed = round2(unitPrice * quantity);
  if (amount == null || !(amount > 0)) return computed;
  // Quantity is rounded to the nearest 0.01, so price × quantity can be off
  // the real amount by up to half a hundredth of the price.
  const slack = unitPrice * 0.005 + 0.005;
  return Math.abs(amount - unitPrice * quantity) <= slack ? round2(amount) : computed;
}
