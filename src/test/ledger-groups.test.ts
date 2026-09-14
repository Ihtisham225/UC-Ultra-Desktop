import { describe, it, expect } from "vitest";
import { allocateSettlement, groupLedgers, increaseTarget, ledgerKey } from "@/lib/ledger-groups";
import { personLedgerLog } from "@/lib/ledger-log";

/**
 * One ledger per person. Each unpaid bill keeps its own khata row (so a sale's
 * edit or void reverses exactly its share); the screen folds them into one
 * account, and a payment taken from the person clears their oldest bill first.
 */

const debt = (id: string, over: Partial<{ direction: string; person_name: string; party_id: string | null; phone: string | null; amount: number; paid_amount: number; created_at: string; due_date: string | null }> = {}) => ({
  id,
  direction: "owed_to_me",
  person_name: "Ihtisham ul haq",
  party_id: "p1",
  phone: null,
  amount: 100,
  paid_amount: 0,
  created_at: "2026-09-01T10:00:00Z",
  due_date: null,
  ...over,
});

describe("groupLedgers", () => {
  it("folds two unpaid bills for one person into one account", () => {
    // Tech Town: ORD-214 left 18,070 owing, ORD-215 another 1,700.
    const groups = groupLedgers([
      debt("ord215", { amount: 1700, created_at: "2026-09-14T09:00:00Z" }),
      debt("ord214", { amount: 18070, created_at: "2026-09-13T09:00:00Z", phone: "+923480152906" }),
    ]);
    expect(groups).toHaveLength(1);
    const [g] = groups;
    expect(g.amount).toBe(19770);
    expect(g.remaining).toBe(19770);
    expect(g.debts.map((d) => d.id)).toEqual(["ord214", "ord215"]); // oldest first
    expect(g.phone).toBe("+923480152906"); // taken from whichever row has one
    expect(g.status).toBe("open");
  });

  it("keeps two people with the same name apart when they are different parties", () => {
    const groups = groupLedgers([debt("a", { party_id: "p1" }), debt("b", { party_id: "p2" })]);
    expect(groups).toHaveLength(2);
  });

  it("matches hand-typed rows by name, ignoring case and spacing", () => {
    const groups = groupLedgers([
      debt("a", { party_id: null, person_name: "Ali  Khan" }),
      debt("b", { party_id: null, person_name: " ali khan" }),
    ]);
    expect(groups).toHaveLength(1);
  });

  it("keeps what they owe and what the shop owes them as separate accounts", () => {
    expect(ledgerKey(debt("a"))).not.toBe(ledgerKey(debt("b", { direction: "i_owe" })));
    expect(groupLedgers([debt("a"), debt("b", { direction: "i_owe" })])).toHaveLength(2);
  });

  it("is settled only when every bill is", () => {
    const [g] = groupLedgers([debt("a", { paid_amount: 100 }), debt("b", { amount: 50, paid_amount: 20 })]);
    expect(g.paid).toBe(120);
    expect(g.remaining).toBe(30);
    expect(g.status).toBe("open");
    const [done] = groupLedgers([debt("a", { paid_amount: 100 }), debt("b", { amount: 50, paid_amount: 50 })]);
    expect(done.status).toBe("settled");
  });

  it("uses the paid figure it is given, so a terminal counts settlements not yet pushed", () => {
    const [g] = groupLedgers([debt("a", { paid_amount: 0 })], () => 40);
    expect(g.remaining).toBe(60);
  });

  it("shows the earliest due date among bills still owed", () => {
    const [g] = groupLedgers([
      debt("paid", { paid_amount: 100, due_date: "2026-09-01" }),
      debt("late", { due_date: "2026-10-01" }),
      debt("soon", { due_date: "2026-09-20" }),
    ]);
    expect(g.due_date).toBe("2026-09-20");
  });
});

describe("allocateSettlement", () => {
  const rows = [
    { id: "new", created_at: "2026-09-14T09:00:00Z", remaining: 1700 },
    { id: "old", created_at: "2026-09-13T09:00:00Z", remaining: 18070 },
  ];

  it("clears the oldest bill first", () => {
    expect(allocateSettlement(rows, 5000, 0)).toEqual([{ debt_id: "old", amount: 5000, discount: 0 }]);
  });

  it("carries what's left over onto the next bill", () => {
    expect(allocateSettlement(rows, 19000, 0)).toEqual([
      { debt_id: "old", amount: 18070, discount: 0 },
      { debt_id: "new", amount: 930, discount: 0 },
    ]);
  });

  it("applies cash before the discount, so the discount lands on the last bill cleared", () => {
    expect(allocateSettlement(rows, 19000, 770)).toEqual([
      { debt_id: "old", amount: 18070, discount: 0 },
      { debt_id: "new", amount: 930, discount: 770 },
    ]);
  });

  it("skips a bill already paid off", () => {
    const out = allocateSettlement([{ id: "done", created_at: "2026-01-01", remaining: 0 }, ...rows], 100, 0);
    expect(out).toEqual([{ debt_id: "old", amount: 100, discount: 0 }]);
  });

  it("refuses more than is owed rather than dropping the excess", () => {
    expect(() => allocateSettlement(rows, 19771, 0)).toThrow(/more than the remaining/);
    expect(() => allocateSettlement(rows, 19000, 771)).toThrow(/more than the remaining/);
    expect(() => allocateSettlement(rows, 0, 0)).toThrow(/Enter an amount/);
  });

  it("never loses a cent to rounding", () => {
    const out = allocateSettlement(
      [
        { id: "a", created_at: "1", remaining: 0.1 },
        { id: "b", created_at: "2", remaining: 0.2 },
      ],
      0.3,
      0,
    );
    expect(Math.round(out.reduce((s, p) => s + p.amount, 0) * 100) / 100).toBe(0.3);
  });
});

describe("increaseTarget", () => {
  it("adds to the newest bill still owed, else the newest bill", () => {
    const rows = [
      { id: "old", created_at: "1", left: 10 },
      { id: "new", created_at: "2", left: 0 },
    ];
    expect(increaseTarget(rows, (r) => r.left)?.id).toBe("old");
    expect(increaseTarget(rows.map((r) => ({ ...r, left: 0 })), (r) => r.left)?.id).toBe("new");
    expect(increaseTarget([], () => 0)).toBeNull();
  });
});

describe("personLedgerLog", () => {
  it("reads one person's bills and payments as a single running account", () => {
    const log = personLedgerLog(
      [
        { id: "ord215", amount: 1700, created_at: "2026-09-14T09:00:00", label: "Bill ORD-215" },
        { id: "ord214", amount: 18070, created_at: "2026-09-13T09:00:00", label: "Bill ORD-214" },
      ],
      [
        { id: "p1", debt_id: "ord214", kind: "payment", amount: 18070, discount: 0, payment_date: "2026-09-15" },
        { id: "p2", debt_id: "ord215", kind: "payment", amount: 930, discount: 0, payment_date: "2026-09-15" },
      ],
    );
    expect(log.rows.map((r) => [r.kind, r.label ?? r.id, r.balance_after])).toEqual([
      ["bill", "Bill ORD-214", 18070],
      ["bill", "Bill ORD-215", 19770],
      ["payment", "p1", 1700],
      ["payment", "p2", 770],
    ]);
    expect(log.closing).toBe(770);
    expect(log.totals).toEqual({ billed: 19770, added: 0, paid: 19000, discount: 0 });
  });

  it("charges each bill at its original amount, with added entries as rows of their own", () => {
    // The stored amount is 1,500 because a later entry added 500 to it.
    const log = personLedgerLog(
      [{ id: "a", amount: 1500, created_at: "2026-01-01T10:00:00" }],
      [
        { id: "i", debt_id: "a", kind: "increase", amount: 500, payment_date: "2026-01-05" },
        { id: "p", debt_id: "a", kind: "payment", amount: 200, discount: 100, payment_date: "2026-01-06" },
      ],
    );
    expect(log.rows.map((r) => r.balance_after)).toEqual([1000, 1500, 1200]);
    // Σ amount − Σ (cash + discount): the "Remaining" beside it.
    expect(log.closing).toBe(1500 - 300);
  });

  it("puts a bill before a payment taken the same day", () => {
    const log = personLedgerLog(
      [{ id: "a", amount: 100, created_at: "2026-02-01T18:00:00" }],
      [{ id: "p", debt_id: "a", kind: "payment", amount: 100, payment_date: "2026-02-01", created_at: "2026-02-01T08:00:00" }],
    );
    expect(log.rows.map((r) => r.kind)).toEqual(["bill", "payment"]);
    expect(log.rows.every((r) => r.balance_after >= 0)).toBe(true);
  });

  it("ignores entries for other people's bills", () => {
    const log = personLedgerLog(
      [{ id: "a", amount: 100, created_at: "2026-02-01T10:00:00" }],
      [{ id: "x", debt_id: "someone-else", kind: "payment", amount: 50, payment_date: "2026-02-02" }],
    );
    expect(log.closing).toBe(100);
  });
});
