import { describe, expect, it } from "vitest";
import { lineGoodsTotal, quantityForLineTotal, storedLineGoods } from "@/lib/purchase-line";

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

describe("lineGoodsTotal", () => {
  it("keeps the typed total when the rounded quantity can make it", () => {
    // 740 / 230 = 3.2174 → 3.22, which × 230 is 740.60.
    expect(lineGoodsTotal(230, 3.22, 740)).toBe(740);
  });
  it("falls back to cost × quantity with no typed total", () => {
    expect(lineGoodsTotal(230, 3.22, null)).toBe(740.6);
  });
  it("ignores a typed total that no longer fits (cost or quantity changed)", () => {
    expect(lineGoodsTotal(230, 4, 740)).toBe(920);
  });
});

describe("storedLineGoods", () => {
  it("prefers the stored line total", () => {
    expect(storedLineGoods({ quantity: "3.22", unit_cost: "230", line_total: "740" })).toBe(740);
  });
  it("uses cost × quantity when the row has none", () => {
    expect(storedLineGoods({ quantity: 2, unit_cost: 50 })).toBe(100);
  });
});
