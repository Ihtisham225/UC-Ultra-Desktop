import { describe, it, expect } from "vitest";
import { computeTodayMoney, summarizeTodayMoney, type TodayMoneyInput } from "@/lib/today-money";

// Local midnight, and a stamp an hour into the day, so the test holds in any
// timezone the suite runs in.
const SINCE = new Date(2026, 8, 23, 0, 0, 0);
const NOW = new Date(2026, 8, 23, 10, 0, 0).toISOString();
const YESTERDAY = new Date(2026, 8, 22, 10, 0, 0).toISOString();

const base = (over: Partial<TodayMoneyInput> = {}): TodayMoneyInput => ({
  since: SINCE,
  today: "2026-09-23",
  accounts: [
    { id: "cash", type: "cash" },
    { id: "hbl", type: "bank" },
    { id: "ep", type: "wallet" },
  ],
  sales: [], salePayments: [], returns: [], debts: [], debtPayments: [], purchases: [], expenses: [],
  ...over,
});

describe("computeTodayMoney", () => {
  it("splits a bill by its tenders and leaves yesterday's bills out", () => {
    const m = computeTodayMoney(base({
      sales: [
        { id: "s1", total: 800, amount_paid: 800, created_at: NOW },
        { id: "old", total: 999, amount_paid: 999, created_at: YESTERDAY },
      ],
      salePayments: [
        { sale_id: "s1", account_id: "cash", amount: 500 },
        { sale_id: "s1", account_id: "hbl", amount: 300 },
      ],
    }));
    expect(m.sales).toMatchObject({ cash: 500, bank: 300, total: 800 });
  });

  it("does not count change handed back, and falls back to the bill's method", () => {
    const m = computeTodayMoney(base({
      sales: [
        { id: "s", total: 800, amount_paid: 1000, payment_method: "cash", created_at: NOW },
        { id: "c", total: 300, amount_paid: 300, payment_method: "card", created_at: NOW },
      ],
    }));
    expect(m.sales).toMatchObject({ cash: 800, bank: 300, none: 0, total: 1100 });
  });

  it("books ledger settlements by direction, and cheques as cheques", () => {
    const m = computeTodayMoney(base({
      debts: [
        { id: "cust", direction: "owed_to_me" },
        { id: "sup", direction: "i_owe" },
        // A customer overpaid by cheque: the excess opens an i_owe row — money IN.
        { id: "xs", direction: "i_owe", amount: 50, cheque_id: "chq", created_at: NOW },
        // …and by cash into the drawer.
        { id: "adv", direction: "i_owe", amount: 40, advance_account_id: "cash", created_at: NOW },
      ],
      debtPayments: [
        { debt_id: "cust", amount: 200, account_id: "ep", created_at: NOW },
        { debt_id: "cust", amount: 400, cheque_id: "chq", created_at: NOW },
        { debt_id: "sup", amount: 150, account_id: "cash", created_at: NOW },
        { debt_id: "cust", amount: 25, created_at: NOW },
      ],
    }));
    expect(m.ledger_in).toMatchObject({ cash: 40, wallet: 200, cheque: 450, none: 25, total: 715 });
    expect(m.ledger_out).toMatchObject({ cash: 150, total: 150 });
  });

  it("ignores what moves no money", () => {
    const m = computeTodayMoney(base({
      debts: [{ id: "cust", direction: "owed_to_me" }],
      debtPayments: [
        { debt_id: "cust", kind: "increase", amount: 500, created_at: NOW },
        { debt_id: "cust", amount: 90, sale_return_id: "r1", created_at: NOW },
        { debt_id: "cust", amount: 60, created_at: YESTERDAY },
      ],
      returns: [
        { total_refund: 70, credited_to_ledger: true, created_at: NOW },
        { total_refund: 100, account_id: "cash", created_at: NOW },
      ],
    }));
    expect(m.ledger_in.total).toBe(0);
    expect(m.returns).toMatchObject({ cash: 100, total: 100 });
  });

  it("counts what a purchase paid, not its total, and expenses by their date", () => {
    const m = computeTodayMoney(base({
      purchases: [{ paid_amount: 700, account_id: "hbl", created_at: NOW }],
      expenses: [
        { amount: 60, account_id: "cash", expense_date: "2026-09-23" },
        { amount: 99, account_id: "cash", expense_date: "2026-09-22" },
      ],
    }));
    expect(m.purchases).toMatchObject({ bank: 700, total: 700 });
    expect(m.expenses).toMatchObject({ cash: 60, total: 60 });
  });

  it("nets in against out, only over the rows the viewer may see", () => {
    const m = computeTodayMoney(base({
      sales: [{ id: "s", total: 1000, amount_paid: 1000, payment_method: "cash", created_at: NOW }],
      purchases: [{ paid_amount: 300, account_id: "cash", created_at: NOW }],
      expenses: [{ amount: 50, account_id: "cash", expense_date: "2026-09-23" }],
    }));
    expect(summarizeTodayMoney(m).net).toMatchObject({ cash: 650, total: 650 });
    const noPurchases = summarizeTodayMoney(m, (src) => src !== "purchases");
    expect(noPurchases.net).toMatchObject({ cash: 950, total: 950 });
  });
});
