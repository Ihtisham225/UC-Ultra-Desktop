import { describe, it, expect } from "vitest";
import { deriveCollection } from "@/lib/ledger";

/**
 * The terminal derives today's collection from the offline store; the web runs
 * the same split in SQL. If the two rules drift, a shop sees one figure at the
 * counter and another on the web for the same day — so the rule is pinned.
 */
const TODAY = new Date("2026-09-05T00:00:00Z");
const at = (iso: string) => iso;

const accounts = new Map<string, string>([
  ["cash-1", "cash"],
  ["bank-1", "bank"],
  ["wallet-1", "wallet"],
]);

describe("deriveCollection", () => {
  it("splits cash from bank and wallet, which count together", () => {
    const c = deriveCollection(
      [
        { kind: "payment", amount: 5000, account_id: "cash-1", created_at: at("2026-09-05T04:00:00Z") },
        { kind: "payment", amount: 3000, account_id: "bank-1", created_at: at("2026-09-05T05:00:00Z") },
        { kind: "payment", amount: 1500, account_id: "wallet-1", created_at: at("2026-09-05T06:00:00Z") },
      ],
      accounts,
      TODAY,
    );
    expect(c.cash).toBe(5000);
    expect(c.banked).toBe(4500);
    expect(c.total).toBe(9500);
  });

  it("keeps money with no account rather than losing it between the columns", () => {
    const c = deriveCollection(
      [
        { kind: "payment", amount: 2000, account_id: "cash-1", created_at: at("2026-09-05T04:00:00Z") },
        { kind: "payment", amount: 800, account_id: null, created_at: at("2026-09-05T04:30:00Z") },
        // An account the terminal has not pulled yet is unattributable too.
        { kind: "payment", amount: 200, account_id: "unknown", created_at: at("2026-09-05T04:40:00Z") },
      ],
      accounts,
      TODAY,
    );
    expect(c.unassigned).toBe(1000);
    expect(c.cash + c.banked + c.unassigned).toBe(c.total);
  });

  it("ignores an 'increase' — it raises what is owed, it collects nothing", () => {
    const c = deriveCollection(
      [
        { kind: "increase", amount: 9000, account_id: "cash-1", created_at: at("2026-09-05T04:00:00Z") },
        { kind: "payment", amount: 100, account_id: "cash-1", created_at: at("2026-09-05T04:00:00Z") },
      ],
      accounts,
      TODAY,
    );
    expect(c.total).toBe(100);
  });

  it("ignores anything before today", () => {
    const c = deriveCollection(
      [
        { kind: "payment", amount: 4000, account_id: "cash-1", created_at: at("2026-09-04T23:59:00Z") },
        { kind: "payment", amount: 60, account_id: "cash-1", created_at: at("2026-09-05T00:01:00Z") },
      ],
      accounts,
      TODAY,
    );
    expect(c.total).toBe(60);
  });

  it("survives string and null amounts off an IndexedDB row", () => {
    const c = deriveCollection(
      [
        { kind: "payment", amount: "120.50", account_id: "cash-1", created_at: at("2026-09-05T04:00:00Z") },
        { kind: "payment", amount: null, account_id: "cash-1", created_at: at("2026-09-05T04:00:00Z") },
      ],
      accounts,
      TODAY,
    );
    expect(c.cash).toBe(120.5);
  });

  it("rounds to two places rather than trailing float noise", () => {
    const c = deriveCollection(
      [
        { kind: "payment", amount: 0.1, account_id: "cash-1", created_at: at("2026-09-05T04:00:00Z") },
        { kind: "payment", amount: 0.2, account_id: "cash-1", created_at: at("2026-09-05T04:00:00Z") },
      ],
      accounts,
      TODAY,
    );
    expect(c.cash).toBe(0.3);
  });

  it("is all zeros on a day with nothing collected", () => {
    expect(deriveCollection([], accounts, TODAY)).toEqual({
      cash: 0, banked: 0, unassigned: 0, total: 0,
    });
  });
});
