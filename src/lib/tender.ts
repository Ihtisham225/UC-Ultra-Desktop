/**
 * Split a bill across tender lines. Shared rule for POS (offline and online)
 * and the server's checkout: each account is credited only with what it
 * actually covers, in order, so an overpayment becomes change rather than a
 * phantom balance, and whatever is left uncovered is what the customer owes.
 */
export const round2 = (n: number) => Math.round(n * 100) / 100;

export interface Tender { account_id: string; amount: number }

export function allocateTenders(total: number, tenders: Tender[]) {
  let remaining = total;
  const applied: Tender[] = [];
  for (const t of tenders) {
    const take = Math.min(t.amount, remaining);
    if (take <= 0) continue;
    applied.push({ account_id: t.account_id, amount: round2(take) });
    remaining = round2(remaining - take);
  }
  const tendered = round2(tenders.reduce((a, t) => a + t.amount, 0));
  // Sum the rounded parts: 50 + 49.99 is 99.99000000000001 in binary floating
  // point, which would write a cent of phantom payment onto the sale.
  const paid = round2(applied.reduce((a, t) => a + t.amount, 0));
  return { applied, paid, change: Math.max(0, round2(tendered - total)), owed: Math.max(0, round2(total - paid)) };
}
