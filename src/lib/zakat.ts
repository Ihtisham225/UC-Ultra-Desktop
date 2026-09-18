/**
 * Zakat on a shop — the arithmetic, kept separate from where the figures come
 * from so the page, the saved record and the tests all agree.
 *
 * Zakat is 2.5% of zakatable wealth held for a lunar year, due only when that
 * wealth is at least the nisab (the value of 87.48 g of gold or 612.36 g of
 * silver). For a shop, zakatable wealth is cash, stock held for sale and money
 * owed to it that can be recovered, less debts due now. Fixed assets — the
 * shop's fittings and equipment — are not counted.
 *
 * This is a calculator, not a ruling: every line can be ticked off or edited,
 * and the page tells the shopkeeper to confirm with a scholar.
 *
 * Pure. A copy of the web app's `src/lib/zakat.ts` — keep the two in step.
 */

export const ZAKAT_RATE = 0.025;
export const NISAB_GRAMS = { gold: 87.48, silver: 612.36 } as const;
export type NisabBasis = keyof typeof NISAB_GRAMS;
export type StockValuation = "sale" | "cost";

export interface ZakatLine {
  key: string;
  label: string;
  amount: number;
  kind: "asset" | "liability";
  /** Filled from the shop's books, or typed in. */
  source: "auto" | "manual";
  /** Unticked lines are shown but not counted. */
  included: boolean;
  note?: string | null;
}

export interface ZakatResult {
  assets: number;
  liabilities: number;
  net: number;
  nisab: number;
  aboveNisab: boolean;
  due: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function nisabValue(basis: NisabBasis, pricePerGram: number): number {
  return round2(NISAB_GRAMS[basis] * Math.max(0, pricePerGram || 0));
}

export function computeZakat(lines: ZakatLine[], basis: NisabBasis, pricePerGram: number): ZakatResult {
  const counted = lines.filter((l) => l.included && Number.isFinite(l.amount));
  const assets = round2(counted.filter((l) => l.kind === "asset").reduce((a, l) => a + Math.max(0, l.amount), 0));
  const liabilities = round2(counted.filter((l) => l.kind === "liability").reduce((a, l) => a + Math.max(0, l.amount), 0));
  const net = round2(assets - liabilities);
  const nisab = nisabValue(basis, pricePerGram);
  // Without a metal price there's no threshold to compare against yet.
  const aboveNisab = nisab > 0 && net >= nisab;
  return { assets, liabilities, net, nisab, aboveNisab, due: aboveNisab ? round2(net * ZAKAT_RATE) : 0 };
}
