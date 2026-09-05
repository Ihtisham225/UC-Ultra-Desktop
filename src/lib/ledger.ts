/**
 * A khata's paid figure, derived the way the server derives it.
 *
 * ⚠️ `debts.paid_amount` is NOT read from the row on an offline terminal: the
 * stored column is the server's figure and lags any settlement taken with no
 * connection, so a shop that had just taken money would still be shown the old
 * balance. This mirrors `recalcDebt` on the server exactly — cash plus the
 * written-off discount, counting only entries of kind "payment" — so the
 * number on screen and the number the push writes always agree.
 *
 * An "increase" raises the principal instead of clearing it, which is why it
 * is excluded here rather than subtracted.
 */
export function derivePaidAmount(
  payments: { kind?: string | null; amount?: number | string | null; discount?: number | string | null }[],
): number {
  const total = payments.reduce((sum, p) => {
    if ((p.kind ?? "payment") !== "payment") return sum;
    return sum + Number(p.amount ?? 0) + Number(p.discount ?? 0);
  }, 0);
  return Math.round(total * 100) / 100;
}

/** What the book took in, split by where the money landed. */
export interface LedgerCollection {
  cash: number;
  banked: number;
  unassigned: number;
  total: number;
}

/**
 * Today's ledger collection, derived from the offline store.
 *
 * Mirrors `ledgerCollectionToday` in the web app's `src/lib/ledger-collection.ts`
 * exactly — cash accounts on one side, bank and wallet together on the other —
 * so the terminal and the web can never show different figures for the same
 * day. Change one, change the other.
 *
 * ⚠️ `unassigned` is not decoration. A settlement can be recorded with no
 * account (the picker can be cleared, and imported ledger payments have none),
 * and that money belongs to neither column. Dropping it would leave two tiles
 * that quietly failed to add up, so cash + banked + unassigned always equals
 * total.
 *
 * ⚠️ Only `kind === "payment"` counts. An "increase" raises what somebody owes
 * rather than collecting anything.
 */
export function deriveCollection(
  payments: {
    kind?: string | null;
    amount?: number | string | null;
    account_id?: string | null;
    created_at?: string | null;
  }[],
  accountTypeById: Map<string, string>,
  since: Date,
): LedgerCollection {
  let cash = 0;
  let banked = 0;
  let unassigned = 0;

  for (const p of payments) {
    if ((p.kind ?? "payment") !== "payment") continue;
    if (!p.created_at || new Date(p.created_at) < since) continue;
    const amount = Number(p.amount ?? 0);
    if (!Number.isFinite(amount)) continue;

    const type = p.account_id ? accountTypeById.get(p.account_id) : undefined;
    if (!type) unassigned += amount;
    else if (type === "cash") cash += amount;
    else banked += amount;
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    cash: r2(cash),
    banked: r2(banked),
    unassigned: r2(unassigned),
    total: r2(cash + banked + unassigned),
  };
}
