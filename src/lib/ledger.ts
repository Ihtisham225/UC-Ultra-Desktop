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
