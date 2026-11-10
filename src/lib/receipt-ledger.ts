/**
 * The customer's khata on the receipt: what they owed before this bill, what
 * this bill leaves unpaid, and what they owe now.
 *
 * One rule for both the on-screen slip and the printed one, so the two can never
 * disagree. A copy of the web app's `src/lib/receipt-ledger.ts` — keep the two in step.
 *
 * Returns null — print nothing extra — when:
 * - the bill carries no `previous_balance` snapshot. That is every walk-in, and
 *   every bill written before the snapshot existed; recomputing one for an old
 *   bill would print today's balance as if it were the balance then.
 * - the customer's balance was exactly 0 before. Then "previous 0 + this bill =
 *   total" is just the ordinary BALANCE DUE line, and repeating it adds nothing.
 */
export interface ReceiptLedger {
  /** Shown as a positive figure; `previousLabel` says which way it faces. */
  previous: number;
  previousLabel: string;
  thisBill: number;
  /** Shown as a positive figure; `totalLabel` says which way it faces. */
  total: number;
  totalLabel: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function receiptLedger(sale: {
  previous_balance?: number | string | null;
  balance_due?: number | string | null;
}): ReceiptLedger | null {
  if (sale.previous_balance === null || sale.previous_balance === undefined) return null;
  const previous = round2(Number(sale.previous_balance));
  if (!Number.isFinite(previous) || previous === 0) return null;
  const due = Number(sale.balance_due ?? 0);
  const thisBill = round2(Number.isFinite(due) ? Math.max(0, due) : 0);
  // A NEGATIVE previous balance is credit the customer held (the shop owed
  // them — a cheque for more than they owed, say). The bill is set off
  // against it, so the slip shows the credit and what is owed after.
  const total = round2(previous + thisBill);
  return {
    previous: Math.abs(previous),
    previousLabel: previous < 0 ? "Credit held" : "Previous balance",
    thisBill,
    total: Math.abs(total),
    totalLabel: total < 0 ? "CREDIT LEFT" : "TOTAL BALANCE",
  };
}
