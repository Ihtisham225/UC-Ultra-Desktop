/**
 * Changing many products' prices at once: set them all to one price, or move
 * them by a percentage or a fixed amount (up or down). Optionally rounded to a
 * whole rupee. A price never goes below zero.
 *
 * Variants with their own price follow the same change when it's relative
 * (+10%, −20); "set to" leaves them alone, since one figure for every size
 * would wipe out the difference between them.
 *
 * ⚠️ Pure and COPIED verbatim to the desktop (pinned by src/test/bulk-price.test.ts).
 */

export type BulkPriceMode = "set" | "percent" | "amount";

export interface BulkPriceOp {
  mode: BulkPriceMode;
  /** set: the new price; percent: +10 / −10; amount: +50 / −50. */
  value: number;
  /** Round the result to a whole number. */
  round?: boolean;
}

export function applyBulkPrice(price: number, op: BulkPriceOp): number {
  const p = Number(price) || 0;
  const v = Number(op.value) || 0;
  let next = op.mode === "set" ? v : op.mode === "percent" ? p * (1 + v / 100) : p + v;
  next = Math.max(0, next);
  return op.round ? Math.round(next) : Math.round(next * 100) / 100;
}

/** Whether a variant's own price should follow the change. */
export const changesVariantPrices = (op: BulkPriceOp) => op.mode !== "set";

/** A one-line description for the toast and the activity log. */
export function bulkPriceLabel(op: BulkPriceOp, money: (n: number) => string): string {
  const sign = op.value >= 0 ? "+" : "−";
  const abs = Math.abs(op.value);
  const what = op.mode === "set" ? `set to ${money(op.value)}` : op.mode === "percent" ? `${sign}${abs}%` : `${sign}${money(abs)}`;
  return `${what}${op.round ? ", rounded" : ""}`;
}
