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

// ─── One person's whole account ──────────────────────────────────────────────

export interface PersonLogDebt {
  id: string;
  amount: number | string;
  created_at: string;
  /** How the bill is named in the log, e.g. "Bill ORD-214" or the row's notes. */
  label?: string | null;
}

export interface PersonLogRow {
  id: string;
  date: string;
  kind: "bill" | "increase" | "payment";
  label: string | null;
  notes: string | null;
  account_name: string | null;
  amount: number;
  discount: number;
  change: number;
  balance_after: number;
}

export interface PersonLog {
  rows: PersonLogRow[];
  closing: number;
  totals: { billed: number; added: number; paid: number; discount: number };
}

/**
 * A person's account across ALL their khata rows, in date order: each bill as a
 * charge on the day it was raised, then every "added" entry and payment.
 *
 * Starts from zero rather than an opening lump, so the balance column is true on
 * every line — a bill raised last week doesn't appear as money owed a month ago.
 * Each bill's charge is its ORIGINAL amount (amount minus its own "added"
 * entries, which appear as rows of their own), so the closing figure is
 * Σ amount − Σ paid: the same "Remaining" the list shows.
 */
export function personLedgerLog(
  debts: PersonLogDebt[],
  payments: (LedgerLogPayment & { debt_id: string })[],
): PersonLog {
  const ids = new Set(debts.map((d) => d.id));
  const mine = payments.filter((p) => ids.has(p.debt_id) && (p.kind === "increase" || p.kind === "payment"));
  const addedBy = new Map<string, number>();
  for (const p of mine) if (p.kind === "increase") addedBy.set(p.debt_id, (addedBy.get(p.debt_id) ?? 0) + num(p.amount));

  // ⚠️ A bill's day is the LOCAL calendar day it was raised. Its stamp is an
  // instant, and taking the first ten characters of the ISO string would put a
  // sale rung up before 5 AM in Pakistan on the previous day.
  const localDay = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso.slice(0, 10)
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  // Within one day a bill comes before what is paid against it.
  const rank = { bill: 0, increase: 1, payment: 1 } as const;
  type Pending = Omit<PersonLogRow, "balance_after"> & { at: string };
  const pending: Pending[] = [
    ...debts.map((d) => {
      const original = round2(num(d.amount) - (addedBy.get(d.id) ?? 0));
      return {
        id: `bill:${d.id}`,
        at: d.created_at,
        date: localDay(d.created_at),
        kind: "bill" as const,
        label: d.label?.trim() || null,
        notes: null,
        account_name: null,
        amount: original,
        discount: 0,
        change: original,
      };
    }),
    ...mine.map((p) => {
      const amount = num(p.amount);
      const off = p.kind === "payment" ? num(p.discount) : 0;
      return {
        id: p.id,
        at: p.created_at ?? "",
        date: p.payment_date,
        kind: p.kind as "increase" | "payment",
        label: null,
        notes: p.notes?.trim() || null,
        account_name: p.account_name ?? null,
        amount: round2(amount),
        discount: round2(off),
        change: round2(p.kind === "increase" ? amount : -(amount + off)),
      };
    }),
  ];
  pending.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || rank[a.kind] - rank[b.kind] || a.at.localeCompare(b.at) || a.id.localeCompare(b.id),
  );

  let balance = 0;
  const totals = { billed: 0, added: 0, paid: 0, discount: 0 };
  const rows: PersonLogRow[] = pending.map(({ at, ...r }) => {
    void at; // only used to sort
    balance = round2(balance + r.change);
    if (r.kind === "bill") totals.billed += r.amount;
    else if (r.kind === "increase") totals.added += r.amount;
    else {
      totals.paid += r.amount;
      totals.discount += r.discount;
    }
    return { ...r, balance_after: balance };
  });
  return {
    rows,
    closing: balance,
    totals: {
      billed: round2(totals.billed),
      added: round2(totals.added),
      paid: round2(totals.paid),
      discount: round2(totals.discount),
    },
  };
}
