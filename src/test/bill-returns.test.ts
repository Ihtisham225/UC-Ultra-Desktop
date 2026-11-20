import { describe, expect, it } from "vitest";
import { billReturnTotals, hasBillReturns, returnedLines, takenLine } from "@/lib/bill-returns";

// 10 cakes taken, 2 handed back; 10 kheer taken, 4 handed back — one bill.
const lines = [
  { product_name: "Cake", quantity: 8, returned_quantity: 2, unit_price: 50, line_total: 400 },
  { product_name: "Kheer", quantity: 6, returned_quantity: 4, unit_price: 120, line_total: 720 },
  { product_name: "Tea", quantity: 1, returned_quantity: null, unit_price: 30, line_total: 30 },
];

describe("bill-returns", () => {
  it("rebuilds what was taken from the net line", () => {
    expect(takenLine(lines[0])).toMatchObject({ quantity: 10, line_total: 500 });
    expect(takenLine(lines[2])).toBe(lines[2]);
  });

  it("lists only the lines that came back, at their bill price", () => {
    expect(returnedLines(lines).map((l) => [l.product_name, l.quantity, l.line_total])).toEqual([
      ["Cake", 2, 100],
      ["Kheer", 4, 480],
    ]);
  });

  it("taken − returned is the stored net subtotal", () => {
    const t = billReturnTotals(lines);
    expect(t).toEqual({ taken: 1730, returned: 580 });
    expect(t.taken - t.returned).toBe(400 + 720 + 30);
  });

  it("a fully returned line keeps a zero net and prints in both sections", () => {
    const all = { product_name: "Cake", quantity: 0, returned_quantity: 3, unit_price: 50, line_total: 0 };
    expect(hasBillReturns([all])).toBe(true);
    expect(takenLine(all)).toMatchObject({ quantity: 3, line_total: 150 });
    expect(billReturnTotals([all])).toEqual({ taken: 150, returned: 150 });
  });

  it("an ordinary bill has no returns", () => {
    expect(hasBillReturns([lines[2]])).toBe(false);
    expect(hasBillReturns(undefined)).toBe(false);
  });
});
