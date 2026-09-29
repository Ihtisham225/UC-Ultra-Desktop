import { describe, it, expect } from "vitest";
import { groupPaymentParts } from "@/lib/payment-parts";

/**
 * Tech Town, PR-2: 35,000 handed over against two bills was listed as 8,070
 * and 26,930 — read as the app splitting the payment. One payment, one row.
 */
describe("one payment, one row", () => {
  const rows = groupPaymentParts([
    { id: "a", debt_id: "bill1", kind: "payment", amount: 8070, discount: 0, receipt_id: "PR-2" },
    { id: "b", debt_id: "bill2", kind: "payment", amount: 26930, discount: 0, receipt_id: "PR-2" },
    { id: "c", debt_id: "bill2", kind: "increase", amount: 50000, receipt_id: null },
    { id: "d", debt_id: "bill1", kind: "payment", amount: 500, discount: 100, receipt_id: null },
    { id: "e", debt_id: "bill1", kind: "payment", amount: 1000, discount: 0, receipt_id: "PR-3" },
  ]);

  it("folds a payment's parts into the payment", () => {
    expect(rows[0]).toMatchObject({ id: "a", amount: 35000, ids: ["a", "b"], debt_ids: ["bill1", "bill2"] });
  });
  it("leaves entries with no receipt, and other payments, as their own rows", () => {
    expect(rows.map((r) => r.ids)).toEqual([["a", "b"], ["c"], ["d"], ["e"]]);
    expect(rows[2]).toMatchObject({ amount: 500, discount: 100 });
  });
});
