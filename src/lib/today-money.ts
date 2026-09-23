/**
 * Today's money: what came in and went out, by source (sales, the ledger,
 * purchases…) and by instrument (cash, bank, wallet, cheque).
 *
 * ⚠️ Pure and COPIED VERBATIM into the desktop (`src/lib/today-money.ts`
 * there). The web feeds it rows from Prisma, the terminal feeds it rows from
 * its offline store; keeping one implementation is what stops the two
 * dashboards disagreeing about the same day. Change both together.
 *
 * Rows are the synced (snake_case) shape. Money fields may arrive as numbers
 * or as decimal strings, so everything goes through `num`.
 *
 * What counts:
 * - Sales: each bill rung up today, by its tenders (`sale_payments`). Paid
 *   money with no tender row goes by the bill's payment method — older bills
 *   and the plain one-method checkout never wrote one. Change handed back is
 *   not money kept.
 * - Returns: refunds paid out today. A refund credited to the customer's
 *   ledger moves no money and is left out.
 * - Ledger in / out: settlements taken today on the khata. Which way is the
 *   parent row's direction — a customer paying off `owed_to_me` is money in, the
 *   shop paying a supplier's `i_owe` is money out. A settlement by cheque
 *   (`cheque_id`) is a cheque, whatever account the cheque later clears into.
 *   The excess of an overpayment opens a NEW row in the opposite direction
 *   (`advance_account_id` for cash, `cheque_id` for a cheque), and that
 *   excess is money too, so it is counted from the row itself.
 *   Written-off discounts and return credits are NOT money and are skipped.
 * - Purchases: what was handed over today (`paid_amount`, not the total —
 *   the rest went on the supplier's khata).
 * - Expenses: dated today.
 *
 * With no account, a record's payment method decides (cash → cash, card →
 * bank, mobile → wallet); only what has neither lands in `none`.
 */

export type Instrument = "cash" | "bank" | "wallet" | "cheque" | "none";
export const INSTRUMENTS: Instrument[] = ["cash", "bank", "wallet", "cheque", "none"];

export type MoneySource = "sales" | "returns" | "ledger_in" | "ledger_out" | "purchases" | "expenses";
export const MONEY_SOURCES: { key: MoneySource; dir: "in" | "out" }[] = [
  { key: "sales", dir: "in" },
  { key: "ledger_in", dir: "in" },
  { key: "returns", dir: "out" },
  { key: "ledger_out", dir: "out" },
  { key: "purchases", dir: "out" },
  { key: "expenses", dir: "out" },
];

export type InstrumentSplit = Record<Instrument, number> & { total: number };
export type TodayMoney = Record<MoneySource, InstrumentSplit>;

type Money = number | string | null | undefined;
type Stamp = string | Date | null | undefined;

export interface TodayMoneyInput {
  /** Start of today, as an instant. */
  since: Date;
  /** Today as a local calendar day, "YYYY-MM-DD" — expenses are dated, not stamped. */
  today: string;
  accounts: { id: string; type?: string | null }[];
  sales: {
    id: string;
    amount_paid?: Money;
    total?: Money;
    payment_method?: string | null;
    created_at?: Stamp;
  }[];
  salePayments: { sale_id: string; account_id?: string | null; amount: Money }[];
  returns: {
    total_refund?: Money;
    account_id?: string | null;
    refund_method?: string | null;
    credited_to_ledger?: boolean | null;
    created_at?: Stamp;
  }[];
  debts: {
    id: string;
    direction: string;
    amount?: Money;
    advance_account_id?: string | null;
    cheque_id?: string | null;
    created_at?: Stamp;
  }[];
  debtPayments: {
    debt_id: string;
    kind?: string | null;
    amount: Money;
    account_id?: string | null;
    cheque_id?: string | null;
    sale_return_id?: string | null;
    created_at?: Stamp;
  }[];
  purchases: {
    paid_amount?: Money;
    account_id?: string | null;
    payment_method?: string | null;
    created_at?: Stamp;
  }[];
  expenses: {
    amount: Money;
    account_id?: string | null;
    payment_method?: string | null;
    expense_date?: Stamp;
  }[];
}

const num = (v: Money) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

const emptySplit = (): InstrumentSplit => ({ cash: 0, bank: 0, wallet: 0, cheque: 0, none: 0, total: 0 });

const onOrAfter = (v: Stamp, since: Date) => {
  if (!v) return false;
  const t = (v instanceof Date ? v : new Date(v)).getTime();
  return Number.isFinite(t) && t >= since.getTime();
};

/** A DATE column arrives as "2026-09-23", an ISO instant, or a Date at UTC midnight. */
const dayOf = (v: Stamp) => {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
};

export function computeTodayMoney(input: TodayMoneyInput): TodayMoney {
  const out = Object.fromEntries(MONEY_SOURCES.map((s) => [s.key, emptySplit()])) as TodayMoney;
  const accountType = new Map(input.accounts.map((a) => [a.id, a.type ?? null]));

  // With no account, the record's own payment method is the next best word
  // (cash / card / mobile). Ledger settlements have none, so they stay "none".
  const byMethod = (method: string | null | undefined): Instrument =>
    method === "cash" ? "cash" : method === "card" ? "bank" : method === "mobile" ? "wallet" : "none";
  const instrumentOf = (accountId: string | null | undefined, method?: string | null): Instrument => {
    if (!accountId) return byMethod(method);
    const t = accountType.get(accountId);
    if (t === "cash") return "cash";
    if (t === "wallet") return "wallet";
    // An account the caller didn't know about still moved money; banks are
    // the default account type, so that is the least surprising bucket.
    return "bank";
  };
  const add = (src: MoneySource, ins: Instrument, amount: number) => {
    if (!(amount > 0)) return;
    out[src][ins] += amount;
  };

  // Sales: tenders first, and whatever was paid beyond them has no account.
  const todaysSales = input.sales.filter((s) => onOrAfter(s.created_at, input.since));
  const tendersBySale = new Map<string, { account_id?: string | null; amount: Money }[]>();
  for (const p of input.salePayments) {
    const list = tendersBySale.get(p.sale_id);
    if (list) list.push(p);
    else tendersBySale.set(p.sale_id, [p]);
  }
  for (const s of todaysSales) {
    let tendered = 0;
    for (const t of tendersBySale.get(s.id) ?? []) {
      const a = num(t.amount);
      tendered += a;
      add("sales", instrumentOf(t.account_id), a);
    }
    // ⚠️ Capped at the bill: the plain cash checkout stores what was HANDED
    // OVER (1000 for an 800 bill), and the 200 went back as change.
    const kept = s.total == null ? num(s.amount_paid) : Math.min(num(s.amount_paid), num(s.total));
    add("sales", byMethod(s.payment_method), round2(kept - tendered));
  }

  for (const r of input.returns) {
    if (r.credited_to_ledger || !onOrAfter(r.created_at, input.since)) continue;
    add("returns", instrumentOf(r.account_id, r.refund_method), num(r.total_refund));
  }

  const debtById = new Map(input.debts.map((d) => [d.id, d]));
  for (const p of input.debtPayments) {
    // "increase" raises what is owed; a return credit settles without money.
    if ((p.kind ?? "payment") !== "payment" || p.sale_return_id) continue;
    if (!onOrAfter(p.created_at, input.since)) continue;
    const debt = debtById.get(p.debt_id);
    if (!debt) continue;
    const src: MoneySource = debt.direction === "i_owe" ? "ledger_out" : "ledger_in";
    add(src, p.cheque_id ? "cheque" : instrumentOf(p.account_id), num(p.amount));
  }
  // An overpayment's excess: the new row faces the other way, so a customer's
  // excess is an `i_owe` row — money IN.
  for (const d of input.debts) {
    if (!d.advance_account_id && !d.cheque_id) continue;
    if (!onOrAfter(d.created_at, input.since)) continue;
    const src: MoneySource = d.direction === "i_owe" ? "ledger_in" : "ledger_out";
    add(src, d.cheque_id ? "cheque" : instrumentOf(d.advance_account_id), num(d.amount));
  }

  for (const p of input.purchases) {
    if (!onOrAfter(p.created_at, input.since)) continue;
    add("purchases", instrumentOf(p.account_id, p.payment_method), num(p.paid_amount));
  }

  for (const e of input.expenses) {
    if (dayOf(e.expense_date) !== input.today) continue;
    add("expenses", instrumentOf(e.account_id, e.payment_method), num(e.amount));
  }

  for (const s of MONEY_SOURCES) {
    const split = out[s.key];
    for (const i of INSTRUMENTS) split[i] = round2(split[i]);
    split.total = round2(INSTRUMENTS.reduce((a, i) => a + split[i], 0));
  }
  return out;
}

/** In, out and net per instrument, over the sources the viewer may see. */
export function summarizeTodayMoney(
  money: TodayMoney,
  visible: (src: MoneySource) => boolean = () => true,
): { in: InstrumentSplit; out: InstrumentSplit; net: InstrumentSplit } {
  const res = { in: emptySplit(), out: emptySplit(), net: emptySplit() };
  for (const s of MONEY_SOURCES) {
    if (!visible(s.key)) continue;
    for (const k of [...INSTRUMENTS, "total"] as const) res[s.dir][k] += money[s.key][k];
  }
  for (const k of [...INSTRUMENTS, "total"] as const) {
    res.in[k] = round2(res.in[k]);
    res.out[k] = round2(res.out[k]);
    res.net[k] = round2(res.in[k] - res.out[k]);
  }
  return res;
}
