/**
 * What each customer / supplier stands at on the Ledger (khata), for the
 * Customers and Suppliers lists.
 *
 * A person can have rows facing both ways — they owe the shop for a credit
 * bill AND the shop owes them for goods it took on credit — so the two sides
 * are kept apart and each page nets them from its own point of view:
 *
 * - Suppliers: what the shop has to PAY them; negative when they owe the shop.
 * - Customers: what the shop will RECEIVE from them; negative when the shop owes them.
 *
 * Rows are matched by `party_id`; a ledger row typed by name with no party
 * can't be tied to anyone on these lists and is left out (it still shows on
 * the Ledger itself).
 *
 * PURE and COPIED VERBATIM into the desktop app (`src/lib/party-balances.ts`),
 * which feeds it from its offline store. Change both together.
 */

export interface PartyKhata {
  /** Still owed TO the shop by this person. */
  receivable: number;
  /** Still owed BY the shop to this person. */
  payable: number;
}

export interface BalanceRow {
  party_id?: string | null;
  direction: string;
  amount: number | string;
  paid_amount?: number | string | null;
}

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

export function partyKhataBalances(rows: BalanceRow[]): Record<string, PartyKhata> {
  const out: Record<string, PartyKhata> = {};
  for (const r of rows) {
    if (!r.party_id) continue;
    const left = num(r.amount) - num(r.paid_amount);
    if (left <= 0) continue;
    const b = (out[r.party_id] ??= { receivable: 0, payable: 0 });
    if (r.direction === "owed_to_me") b.receivable = round2(b.receivable + left);
    else b.payable = round2(b.payable + left);
  }
  return out;
}

/** Suppliers page: positive = the shop has to pay them, negative = they owe the shop. */
export const supplierBalance = (b: PartyKhata | undefined) => round2((b?.payable ?? 0) - (b?.receivable ?? 0));

/** Customers page: positive = the shop will receive, negative = the shop owes them. */
export const customerBalance = (b: PartyKhata | undefined) => round2((b?.receivable ?? 0) - (b?.payable ?? 0));
