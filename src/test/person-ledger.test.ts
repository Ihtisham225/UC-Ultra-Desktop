import { describe, expect, it } from "vitest";
import { buildLedgerStatement, openingBefore, type StatementDebt, type StatementPayment } from "@/lib/person-ledger";

const debt = (id: string, direction: string, amount: number, day: string, extra: Partial<StatementDebt> = {}): StatementDebt =>
  ({ id, direction, amount, created_at: `${day}T10:00:00`, notes: null, ...extra });
const pay = (id: string, debt_id: string, amount: number, day: string, extra: Partial<StatementPayment> = {}): StatementPayment =>
  ({ id, debt_id, amount, discount: 0, kind: "payment", payment_date: day, created_at: `${day}T12:00:00`, notes: null, account_name: "Cash", ...extra });

describe("buildLedgerStatement", () => {
  it("folds both directions of a supplier's account into one payable balance", () => {
    const st = buildLedgerStatement(
      [
        debt("a", "i_owe", 20000, "2026-11-09"),
        debt("b", "i_owe", 8040, "2026-11-13", { purchase_id: "p1", bill_number: "PO-1" }),
        debt("c", "owed_to_me", 3000, "2026-11-14"),
      ],
      [pay("x", "a", 7000, "2026-11-14")],
      "payable",
    );
    expect(st.lines.map((l) => l.balance)).toEqual([20000, 28040, 25040, 18040]);
    expect(st.balance).toBe(18040);
    expect(st.charged).toBe(28040);
    expect(st.paid).toBe(10000);
    expect(st.lines[1].title).toBe("Purchase PO-1");
  });

  it("shows one payment over several bills as one line, discount included", () => {
    const st = buildLedgerStatement(
      [debt("a", "owed_to_me", 5000, "2026-11-01", { sale_id: "s1", bill_number: "10" }), debt("b", "owed_to_me", 5000, "2026-11-02", { sale_id: "s2", bill_number: "11" })],
      [
        pay("p1", "a", 5000, "2026-11-05", { receipt_id: "r1" }),
        pay("p2", "b", 4500, "2026-11-05", { receipt_id: "r1", discount: 500 }),
      ],
      "receivable",
    );
    expect(st.lines).toHaveLength(3);
    expect(st.lines[2].paid).toBe(10000);
    expect(st.lines[2].detail).toContain("discount");
    expect(st.balance).toBe(0);
  });

  it("starts a row at its amount less 'add more debt' entries, which get their own line", () => {
    const st = buildLedgerStatement(
      [debt("a", "owed_to_me", 1500, "2026-11-01")],
      [pay("i", "a", 500, "2026-11-03", { kind: "increase", account_name: null })],
      "receivable",
    );
    expect(st.lines.map((l) => [l.charge, l.balance])).toEqual([[1000, 1000], [500, 1500]]);
  });

  it("leaves out the cancelling pair a credit bill writes against what the shop owed", () => {
    const st = buildLedgerStatement(
      [debt("adv", "i_owe", 3000, "2026-11-01"), debt("bill", "owed_to_me", 10000, "2026-11-02", { sale_id: "s" })],
      [pay("x", "bill", 3000, "2026-11-02", { sale_id: "s", account_name: null }), pay("y", "adv", 3000, "2026-11-02", { sale_id: "s", account_name: null })],
      "receivable",
    );
    expect(st.lines).toHaveLength(2);
    expect(st.balance).toBe(7000);
  });

  it("gives the balance before a date for a filtered view", () => {
    const st = buildLedgerStatement([debt("a", "owed_to_me", 100, "2026-10-01"), debt("b", "owed_to_me", 50, "2026-11-01")], [], "receivable");
    expect(openingBefore(st.lines, "2026-11-01")).toBe(100);
  });
});
