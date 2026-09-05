// Currencies that conventionally use 3 decimal places (per ISO 4217)
const THREE_DECIMAL_CURRENCIES = new Set(["KWD", "BHD", "OMR", "JOD", "TND", "LYD", "IQD"]);

const decimalsFor = (currency: string) =>
  THREE_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 3 : 2;

export const formatMoney = (amount: number | string, currency = "USD", locale?: string) => {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  const fractionDigits = decimalsFor(currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(n || 0);
  } catch {
    return `${currency} ${(n || 0).toFixed(fractionDigits)}`;
  }
};

export const formatNumber = (n: number | string, locale?: string) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  return new Intl.NumberFormat(locale).format(v || 0);
};

/**
 * A quantity as the shopkeeper should read it.
 *
 * Stock is a decimal — oil is sold in half litres — so sums land on binary
 * floating-point noise: 1839.520000000002 where the shelf holds 1839.52.
 * Rounds to 4 places (finer than anyone counts) and drops trailing zeros, so
 * whole numbers still read as "132" rather than "132.0000".
 */
export const formatQty = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "0";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 10000) / 10000);
};

/**
 * A money amount with no currency symbol — "2,630.00".
 *
 * The receipt's item table is only ~72mm wide and prints one currency
 * throughout, so repeating "PKR" in every cell just forces the numbers to wrap
 * mid-column. The counter bill this format follows prints bare numbers in the
 * table and names the currency once, in the totals.
 */
export const formatAmount = (amount: number | string, currency = "USD"): string => {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return "0";
  const digits = decimalsFor(currency);
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

/**
 * How an order number reads before the server has issued one.
 *
 * A bill rung up offline has no number yet — the shop's counter lives on the
 * server so two tills cannot collide — and it gets one the moment the terminal
 * syncs. Showing an empty cell would look like a bug, and inventing a code is
 * what produced the old "R-…" numbers that matched nothing in the books.
 */
export function orderNumberLabel(n?: string | null): string {
  return n && n.trim() !== "" ? n : "Pending sync";
}
