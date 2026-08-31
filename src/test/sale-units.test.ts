import { describe, it, expect } from "vitest";
import { soldAs, formatSoldQuantity } from "@/lib/sale-units";

describe("soldAs", () => {
  it("passes a plain line through untouched", () => {
    expect(soldAs({ quantity: 3, unit_price: 250, line_total: 750 })).toEqual({
      quantity: 3,
      unit: null,
      unitPrice: 250,
    });
  });

  it("converts a line billed in a bigger unit back to what was rung up", () => {
    // 8 litres stored at 250/litre = 2 bottles at 1000.
    expect(
      soldAs({ quantity: 8, unit_price: 250, line_total: 2000, unit_label: "Bottle (4 L)", unit_factor: 4 }),
    ).toEqual({ quantity: 2, unit: "Bottle (4 L)", unitPrice: 1000 });
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

  it("ignores a unit with no usable factor rather than dividing by zero", () => {
    for (const factor of [0, null, undefined, NaN]) {
      const sold = soldAs({ quantity: 8, unit_price: 250, unit_label: "Bottle", unit_factor: factor as number });
      expect(sold).toEqual({ quantity: 8, unit: null, unitPrice: 250 });
    }
  });

  it("ignores a factor with no label — a label is what makes it a unit", () => {
    expect(soldAs({ quantity: 8, unit_price: 250, unit_label: "  ", unit_factor: 4 }).unit).toBeNull();
  });
});

describe("formatSoldQuantity", () => {
  it("names the unit when there is one", () => {
    expect(formatSoldQuantity({ quantity: 2, unit: "Bottle (4 L)", unitPrice: 1000 })).toBe("2 Bottle (4 L)");
  });

  it("prints a bare number in the base unit", () => {
    expect(formatSoldQuantity({ quantity: 3, unit: null, unitPrice: 250 })).toBe("3");
  });

  it("keeps a fractional quantity readable instead of trailing float noise", () => {
    // 0.1 + 0.2 arithmetic upstream must not print as 0.30000000000000004.
    expect(formatSoldQuantity({ quantity: 0.30000000000000004, unit: "Drum", unitPrice: 1 })).toBe("0.3 Drum");
  });
});
