import { describe, expect, it } from "vitest";
import { applyBulkPrice, bulkPriceLabel, changesVariantPrices } from "@/lib/bulk-price";

describe("bulk price change", () => {
  it("raises or lowers by a percentage", () => {
    expect(applyBulkPrice(240, { mode: "percent", value: 10 })).toBe(264);
    expect(applyBulkPrice(120, { mode: "percent", value: -25 })).toBe(90);
  });
  it("moves by a fixed amount, never below zero", () => {
    expect(applyBulkPrice(80, { mode: "amount", value: 20 })).toBe(100);
    expect(applyBulkPrice(80, { mode: "amount", value: -100 })).toBe(0);
  });
  it("sets one price for all", () => {
    expect(applyBulkPrice(80, { mode: "set", value: 150 })).toBe(150);
  });
  it("rounds when asked, otherwise keeps two places", () => {
    expect(applyBulkPrice(99, { mode: "percent", value: 7 })).toBe(105.93);
    expect(applyBulkPrice(99, { mode: "percent", value: 7, round: true })).toBe(106);
  });
  it("carries relative changes to variants' own prices, but not 'set to'", () => {
    expect(changesVariantPrices({ mode: "percent", value: 10 })).toBe(true);
    expect(changesVariantPrices({ mode: "amount", value: 5 })).toBe(true);
    expect(changesVariantPrices({ mode: "set", value: 5 })).toBe(false);
  });
  it("describes the change", () => {
    const m = (n: number) => `Rs ${n}`;
    expect(bulkPriceLabel({ mode: "percent", value: 10 }, m)).toBe("+10%");
    expect(bulkPriceLabel({ mode: "amount", value: -20, round: true }, m)).toBe("−Rs 20, rounded");
    expect(bulkPriceLabel({ mode: "set", value: 150 }, m)).toBe("set to Rs 150");
  });
});
