/**
 * One ledger per person.
 *
 * Every credit sale and unpaid purchase writes its OWN khata row (debts), linked
 * to the bill by `sale_id` / `purchase_id`. That is deliberate and must stay:
 * editing or voiding a bill finds and reverses exactly its row. But it meant a
 * customer with two unpaid bills showed as two ledgers. The fix is to present
 * those rows as one person's account, not to merge them in the database:
 *
 * - `groupLedgers` folds rows into one account per person and direction;
 * - `allocateSettlement` spreads a payment taken from the person across their
 *   rows, oldest bill first;
 * - `increaseTarget` picks the row an "add more" entry lands on.
 *
 * Pure, so the web action, the terminal's offline ledger and the tests all run
 * the very same rules. A copy of the web app's `src/lib/ledger-groups.ts` — keep them in step.
 */

export interface GroupableDebt {
  id: string;
  direction: string;
  person_name: string;
  phone?: string | null;
  party_id?: string | null;
  amount: number | string;
  paid_amount?: number | string | null;
  due_date?: string | null;
  created_at: string;
  currency?: string | null;
}

export interface LedgerGroup<T extends GroupableDebt> {
  key: string;
  direction: string;
  /** The most recent row's spelling, so a corrected name wins. */
  person_name: string;
  phone: string | null;
  party_id: string | null;
  currency: string | null;
  /** Oldest first. */
  debts: T[];
  amount: number;
  paid: number;
  remaining: number;
  status: "open" | "settled";
  /** The earliest due date among rows still owed. */
  due_date: string | null;
  /** The newest row's time, for ordering the list. */
  latest_at: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Who a row belongs to. ⚠️ The party id when there is one — two customers can
 * share a name — and otherwise the name, trimmed, spaces collapsed and case
 * folded, since rows typed by hand have only that. The two directions stay
 * apart: what a person owes the shop and what the shop owes them are separate
 * accounts, exactly as the To receive / To pay tabs already treat them.
 */
export function ledgerKey(d: Pick<GroupableDebt, "direction" | "party_id" | "person_name">): string {
  const who = d.party_id ? `party:${d.party_id}` : `name:${d.person_name.trim().replace(/\s+/g, " ").toLowerCase()}`;
  return `${d.direction}|${who}`;
}

const byOldest = <T extends { created_at: string; id: string }>(a: T, b: T) =>
  a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);

/**
 * `paidOf` lets the terminal pass its locally derived paid figure (which counts
 * settlements not yet pushed); the web uses the stored column.
 */
export function groupLedgers<T extends GroupableDebt>(
  debts: T[],
  paidOf: (d: T) => number = (d) => num(d.paid_amount),
): LedgerGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const d of debts) {
    const k = ledgerKey(d);
    const list = map.get(k);
    if (list) list.push(d);
    else map.set(k, [d]);
  }

  return [...map.entries()].map(([key, rows]) => {
    const sorted = [...rows].sort(byOldest);
    const newest = sorted[sorted.length - 1];
    let amount = 0;
    let paid = 0;
    let remaining = 0;
    let due: string | null = null;
    for (const d of sorted) {
      const a = num(d.amount);
      const p = paidOf(d);
      const left = Math.max(a - p, 0);
      amount += a;
      paid += p;
      remaining += left;
      if (left > 0 && d.due_date && (!due || d.due_date < due)) due = d.due_date;
    }
    return {
      key,
      direction: newest.direction,
      person_name: newest.person_name,
      phone: [...sorted].reverse().find((d) => d.phone)?.phone ?? null,
      party_id: newest.party_id ?? null,
      currency: newest.currency ?? null,
      debts: sorted,
      amount: round2(amount),
      paid: round2(paid),
      remaining: round2(remaining),
      status: remaining > 0.001 ? "open" : "settled",
      due_date: due,
      latest_at: newest.created_at,
    };
  });
}

export interface Allocation {
  debt_id: string;
  amount: number;
  discount: number;
}

/**
 * Spread one payment across a person's rows, oldest bill first.
 *
 * Cash is applied before the written-off discount on each row, so a discount
 * lands on the last bill being cleared — the one a shopkeeper rounds down when
 * a customer settles up.
 *
 * ⚠️ Throws rather than trimming when the payment is more than is owed: silently
 * dropping the excess would record money the customer never got credit for.
 */
export function allocateSettlement(
  rows: { id: string; created_at: string; remaining: number }[],
  amount: number,
  discount: number,
): Allocation[] {
  const cash = round2(Math.max(0, amount));
  const off = round2(Math.max(0, discount));
  const owed = round2(rows.reduce((a, r) => a + Math.max(0, r.remaining), 0));
  if (cash + off <= 0) throw new Error("Enter an amount, a discount, or both");
  if (cash + off > owed + 0.001) {
    throw new Error("Payment and discount together cannot be more than the remaining balance");
  }

  let cashLeft = cash;
  let offLeft = off;
  const out: Allocation[] = [];
  for (const r of [...rows].sort(byOldest)) {
    if (cashLeft <= 0 && offLeft <= 0) break;
    let room = round2(Math.max(0, r.remaining));
    if (room <= 0) continue;
    const c = round2(Math.min(cashLeft, room));
    room = round2(room - c);
    const dsc = round2(Math.min(offLeft, room));
    if (c + dsc > 0) out.push({ debt_id: r.id, amount: c, discount: dsc });
    cashLeft = round2(cashLeft - c);
    offLeft = round2(offLeft - dsc);
  }
  // Rounding can strand a cent; it belongs to the last row paid, never lost.
  if ((cashLeft > 0 || offLeft > 0) && out.length) {
    out[out.length - 1].amount = round2(out[out.length - 1].amount + cashLeft);
    out[out.length - 1].discount = round2(out[out.length - 1].discount + offLeft);
  }
  return out;
}

/**
 * Split a settlement that may be MORE than is owed.
 *
 * A customer who owes 50,000 and hands over 100,000 clears the 50,000 and
 * leaves 50,000 with the shop — which the shop now owes back. Same the other
 * way: overpaying a supplier leaves them owing the shop. `settle` is the cash
 * that goes against what is owed (with the discount), `excess` the cash that
 * opens a row in the OPPOSITE direction.
 *
 * Only cash can be excess. A discount is money given away, so there is no
 * such thing as writing off more than is owed — that still throws.
 *
 * A copy lives in the desktop's `src/lib/ledger-groups.ts` — keep in step.
 */
export function splitOverpayment(
  owed: number,
  cash: number,
  discount: number,
): { settle: number; excess: number } {
  const o = round2(Math.max(0, owed));
  const c = round2(Math.max(0, cash));
  const d = round2(Math.max(0, discount));
  if (d > o + 0.001) throw new Error("The discount cannot be more than the remaining balance");
  const room = round2(o - d);
  const excess = round2(Math.max(0, c - room));
  return { settle: round2(c - excess), excess };
}

/** The direction an overpayment's excess opens. */
export const oppositeDirection = (d: "owed_to_me" | "i_owe"): "owed_to_me" | "i_owe" =>
  d === "owed_to_me" ? "i_owe" : "owed_to_me";

/**
 * Where "add more to this person's account" is recorded: the newest row still
 * owed, else the newest row. It reopens that row if it was settled, which is
 * what adding to a person's account means.
 */
export function increaseTarget<T extends { id: string; created_at: string }>(
  rows: T[],
  remainingOf: (r: T) => number,
): T | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort(byOldest);
  return [...sorted].reverse().find((r) => remainingOf(r) > 0.001) ?? sorted[sorted.length - 1];
}
