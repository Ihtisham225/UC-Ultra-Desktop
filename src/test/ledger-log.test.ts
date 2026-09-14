import { describe, it, expect } from "vitest";
import { ledgerLog } from "@/lib/ledger-log";

/**
 * The payment history under a khata row. Its last line must land on exactly the
 * "Remaining" printed beside it — so it follows the same rule as recalcDebt:
 * the row's amount already includes every "added" entry, and a payment clears
 * its cash AND its written-off discount.
 */

const pay = (id: string, date: string, amount: number, discount = 0) => ({ id, kind: "payment", amount, discount, payment_date: date });
const add = (id: string, date: string, amount: number) => ({ id, kind: "increase", amount, payment_date: date });

describe("ledgerLog", () => {
  it("starts at the amount and walks the balance down to what's left", () => {
    // The screenshot's row: 18,070 raised, nothing paid yet.
    const none = ledgerLog(18070, []);
    expect(none.opening).toBe(18070);
    expect(none.rows).toEqual([]);
    expect(none.closing).toBe(18070);

    const log = ledgerLog(18070, [pay("b", "2026-09-20", 5000), pay("a", "2026-09-15", 3070)]);
    expect(log.rows.map((r) => [r.id, r.balance_after])).toEqual([["a", 15000], ["b", 10000]]);
    expect(log.closing).toBe(10000);
    expect(log.totals.paid).toBe(8070);
  });

  it("ends on amount − paid_amount, the figure the Ledger shows", () => {
    // paid_amount = Σ(amount + discount) over payments (recalcDebt).
    const payments = [pay("p1", "2026-01-02", 400, 100), pay("p2", "2026-01-03", 250)];
    const paidAmount = 400 + 100 + 250;
    expect(ledgerLog(1000, payments).closing).toBe(1000 - paidAmount);
  });

  it("counts a written-off discount against the balance, but not as cash paid", () => {
    const log = ledgerLog(1000, [pay("p", "2026-01-02", 700, 300)]);
    expect(log.closing).toBe(0);
    expect(log.totals.paid).toBe(700);
    expect(log.totals.discount).toBe(300);
    expect(log.rows[0].change).toBe(-1000);
  });

  it("recovers the original amount when entries were added to the khata", () => {
    // The stored amount is 1,500 because a later entry added 500 to it.
    const log = ledgerLog(1500, [add("i", "2026-01-05", 500), pay("p", "2026-01-06", 200)]);
    expect(log.opening).toBe(1000);
    expect(log.rows.map((r) => r.balance_after)).toEqual([1500, 1300]);
    expect(log.closing).toBe(1300);
    expect(log.totals.added).toBe(500);
  });

  it("orders by date, then by when each entry was written", () => {
    const log = ledgerLog(900, [
      { ...pay("later", "2026-02-01", 100), created_at: "2026-02-01T10:00:00Z" },
      { ...pay("earlier", "2026-02-01", 100), created_at: "2026-02-01T09:00:00Z" },
      pay("first", "2026-01-01", 100),
    ]);
    expect(log.rows.map((r) => r.id)).toEqual(["first", "earlier", "later"]);
  });

  it("leaves out entry kinds it doesn't know rather than guessing", () => {
    const log = ledgerLog(1000, [{ id: "x", kind: "note", amount: 999, payment_date: "2026-01-01" }, pay("p", "2026-01-02", 100)]);
    expect(log.rows.map((r) => r.id)).toEqual(["p"]);
    expect(log.closing).toBe(900);
  });

  it("reads the decimal strings a synced row holds, without float drift", () => {
    const log = ledgerLog("100.30", [{ id: "p", kind: "payment", amount: "0.10", discount: "0.20", payment_date: "2026-01-01" }]);
    expect(log.closing).toBe(100);
  });
});
