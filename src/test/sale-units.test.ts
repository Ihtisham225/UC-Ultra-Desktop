import { describe, it, expect } from "vitest";
import { soldAs, formatSoldQuantity, formatUnitQty } from "@/lib/sale-units";

describe("soldAs", () => {
  it("passes a plain line through untouched", () => {
    expect(soldAs({ quantity: 3, unit_price: 250, line_total: 750 })).toEqual({
      quantity: 3,
      unit: null,
      unitPrice: 250,
      converted: false,
    });
  });

  it("keeps the unit the line was measured in, even with nothing to convert", () => {
    // The common case after this release: every line records its unit so the
    // receipt can print a Unit column, but most are already in the base unit.
    expect(soldAs({ quantity: 4, unit_price: 2630, line_total: 10520, unit_label: "LIT" })).toEqual({
      quantity: 4,
      unit: "LIT",
      unitPrice: 2630,
      converted: false,
    });
  });

  it("converts a line billed in a bigger unit back to what was rung up", () => {
    // 8 litres stored at 250/litre = 2 bottles at 1000.
    expect(
      soldAs({ quantity: 8, unit_price: 250, line_total: 2000, unit_label: "Bottle (4 L)", unit_factor: 4 }),
    ).toEqual({ quantity: 2, unit: "Bottle (4 L)", unitPrice: 1000, converted: true });
  });

  it("prefers the stored line total, since the base price is rounded to 2dp", () => {
    // 1000 for 3 litres rounds the stored per-litre price to 333.33; the
    // customer still paid 1000, and that's what the receipt must show.
    const sold = soldAs({ quantity: 3, unit_price: 333.33, line_total: 1000, unit_label: "Jug", unit_factor: 3 });
    expect(sold.unitPrice).toBe(1000);
  });

  it("falls back to multiplying when there is no line total", () => {
    const sold = soldAs({ quantity: 8, unit_price: 250, unit_label: "Bottle", unit_factor: 4 });
    expect(sold.unitPrice).toBe(1000);
  });

  it("keeps the unit but converts nothing when the factor is unusable", () => {
    // A 0 factor would divide the quantity away entirely. The label still
    // prints — it's what the line was measured in either way.
    for (const factor of [0, null, undefined, NaN]) {
      const sold = soldAs({ quantity: 8, unit_price: 250, unit_label: "LIT", unit_factor: factor as number });
      expect(sold).toEqual({ quantity: 8, unit: "LIT", unitPrice: 250, converted: false });
    }
  });

  it("treats a blank label as no unit at all", () => {
    expect(soldAs({ quantity: 8, unit_price: 250, unit_label: "  " }).unit).toBeNull();
  });
});

describe("formatSoldQuantity", () => {
  it("names the unit when there is one", () => {
    expect(formatSoldQuantity({ quantity: 2, unit: "Bottle (4 L)", unitPrice: 1000, converted: true })).toBe("2 Bottle (4 L)");
  });

  it("prints a bare number when the line records no unit", () => {
    expect(formatSoldQuantity({ quantity: 3, unit: null, unitPrice: 250, converted: false })).toBe("3");
  });
});

describe("formatUnitQty", () => {
  it("trims binary floating-point noise", () => {
    expect(formatUnitQty(0.30000000000000004)).toBe("0.3");
    expect(formatUnitQty(3.7)).toBe("3.7");
    expect(formatUnitQty(5)).toBe("5");
  });
});
