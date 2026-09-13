import { describe, it, expect } from "vitest";
import { receiptLedger } from "@/lib/receipt-ledger";

/**
 * The customer's khata on the receipt. Printed only when there is something to
 * say, and never from a figure the bill didn't snapshot at checkout.
 */
describe("receiptLedger", () => {
  it("shows the old balance, this bill, and the new total", () => {
    expect(receiptLedger({ previous_balance: 116630, balance_due: 1000 })).toEqual({
      previous: 116630,
      thisBill: 1000,
      total: 117630,
    });
  });

  it("prints nothing for a bill with no snapshot", () => {
    // A walk-in, or any bill written before the snapshot existed. Recomputing
    // one would print today's balance on an old receipt.
    expect(receiptLedger({ previous_balance: null, balance_due: 500 })).toBeNull();
    expect(receiptLedger({ balance_due: 500 })).toBeNull();
  });

  it("prints nothing when the customer owed nothing before", () => {
    // Then it would only repeat the ordinary BALANCE DUE line.
    expect(receiptLedger({ previous_balance: 0, balance_due: 500 })).toBeNull();
  });

  it("still shows a paid-in-full bill against an old balance", () => {
    expect(receiptLedger({ previous_balance: 2500, balance_due: 0 })).toEqual({ previous: 2500, thisBill: 0, total: 2500 });
  });

  it("reads the decimal strings the database hands back", () => {
    expect(receiptLedger({ previous_balance: "1200.50", balance_due: "99.49" })).toEqual({
      previous: 1200.5,
      thisBill: 99.49,
      total: 1299.99,
    });
  });

  it("never lets a negative due reduce the total", () => {
    expect(receiptLedger({ previous_balance: 1000, balance_due: -50 })).toEqual({ previous: 1000, thisBill: 0, total: 1000 });
  });
});
