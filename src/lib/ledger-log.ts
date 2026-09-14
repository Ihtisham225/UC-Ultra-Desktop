/**
 * The complete story of one khata row: what it started at, every entry against
 * it, and the balance after each — ending on exactly the figure the Ledger
 * shows as "Remaining".
 *
 * That end figure is only guaranteed if this follows the SAME rule as
 * `recalcDebt` (src/lib/debts.ts):
 *   - `debt.amount` already INCLUDES every "increase" entry (they bump it), so
 *     the row started at amount − Σ increases;
 *   - an "increase" adds to the balance;
 *   - a "payment" clears its cash AND its written-off discount.
 * Change one without the other and the log's last line stops matching the
 * balance printed beside it. A copy of the web app's `src/lib/ledger-log.ts` — keep them in step.
 */

export interface LedgerLogPayment {
  id: string;
  kind: string;
  amount: number | string;
  discount?: number | string | null;
  /** yyyy-mm-dd */
  payment_date: string;
  created_at?: string | null;
  notes?: string | null;
  account_name?: string | null;
}

export interface LedgerLogRow {
  id: string;
  date: string;
  kind: "increase" | "payment";
  notes: string | null;
  account_name: string | null;
  /** What the entry added (increase) or collected in cash (payment). */
  amount: number;
  /** Written off on a payment: clears the balance but was never collected. */
  discount: number;
  /** Signed effect on the balance. */
  change: number;
  balance_after: number;
}

export interface LedgerLog {
  /** What the row was raised for, before any entry. */
  opening: number;
  /** Oldest first, so the balance reads down the page. */
  rows: LedgerLogRow[];
  /** Always equals amount − paid_amount for the same row. */
  closing: number;
  totals: { added: number; paid: number; discount: number };
}

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

export function ledgerLog(debtAmount: number | string, payments: LedgerLogPayment[]): LedgerLog {
  // Only the two kinds recalcDebt knows about move the balance; anything else
  // is left out rather than guessed at.
  const known = payments.filter((p) => p.kind === "increase" || p.kind === "payment");
  const ordered = [...known].sort(
    (a, b) =>
      a.payment_date.localeCompare(b.payment_date) ||
      String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")),
  );

  const added = ordered.filter((p) => p.kind === "increase").reduce((a, p) => a + num(p.amount), 0);
  const opening = round2(num(debtAmount) - added);

  let balance = opening;
  let paid = 0;
  let discount = 0;
  const rows: LedgerLogRow[] = ordered.map((p) => {
    const amount = num(p.amount);
    const off = p.kind === "payment" ? num(p.discount) : 0;
    const change = p.kind === "increase" ? amount : -(amount + off);
    if (p.kind === "payment") {
      paid += amount;
      discount += off;
    }
    balance = round2(balance + change);
    return {
      id: p.id,
      date: p.payment_date,
      kind: p.kind as "increase" | "payment",
      notes: p.notes?.trim() || null,
      account_name: p.account_name ?? null,
      amount: round2(amount),
      discount: round2(off),
      change: round2(change),
      balance_after: balance,
    };
  });

  return {
    opening,
    rows,
    closing: round2(balance),
    totals: { added: round2(added), paid: round2(paid), discount: round2(discount) },
  };
}
