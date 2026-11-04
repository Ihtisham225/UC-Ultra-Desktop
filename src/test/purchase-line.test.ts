import { describe, expect, it } from "vitest";
import { quantityForLineTotal } from "@/lib/purchase-line";

describe("quantityForLineTotal", () => {
  it("divides the total by the unit cost", () => {
    expect(quantityForLineTotal(736, 230, 0)).toBe(3.2);
  });
  it("rounds to the 2 decimals a purchase line holds", () => {
    expect(quantityForLineTotal(750, 230, 0)).toBe(3.26);
  });
  it("takes the line's expenses off first (the column shows goods + expenses)", () => {
    expect(quantityForLineTotal(800, 230, 64)).toBe(3.2);
  });
  it("gives no quantity without a unit cost or when expenses eat the total", () => {
    expect(quantityForLineTotal(500, 0, 0)).toBeNull();
    expect(quantityForLineTotal(500, null, 0)).toBeNull();
    expect(quantityForLineTotal(50, 230, 64)).toBeNull();
    expect(quantityForLineTotal(Number.NaN, 230, 0)).toBeNull();
  });
});
