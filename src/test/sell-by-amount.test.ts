import { describe, expect, it } from "vitest";
import { lineTotalOf, priceForAmount, qtyForAmount } from "@/lib/sell-by-amount";

describe("qtyForAmount — Rs 100 of the Rs 250/kg one", () => {
  it("works the quantity out from the amount", () => {
    expect(qtyForAmount(100, 250)).toBe(0.4);
    expect(qtyForAmount(250, 250)).toBe(1);
  });
  it("rounds to the 2 places a sale line stores", () => {
    expect(qtyForAmount(100, 240)).toBe(0.42);
  });
  it("refuses what it can't work out", () => {
    expect(qtyForAmount(0, 250)).toBeNull();
    expect(qtyForAmount(100, 0)).toBeNull();
    expect(qtyForAmount(0.001, 250)).toBeNull();
  });
});

describe("lineTotalOf", () => {
  it("is price × quantity when nothing was typed", () => {
    expect(lineTotalOf(250, 1)).toBe(250);
    expect(lineTotalOf(80, 2)).toBe(160);
  });
  it("keeps the typed amount over the rounded quantity — Rs 100, not 100.80", () => {
    expect(lineTotalOf(240, 0.42, 100)).toBe(100);
  });
  it("drops a stale amount once the quantity or price no longer fits it", () => {
    expect(lineTotalOf(240, 1, 100)).toBe(240);
    expect(lineTotalOf(300, 0.42, 100)).toBe(126);
  });
});

describe("priceForAmount — 24 kheer for Rs 1000", () => {
  it("keeps the quantity and works the price out", () => {
    expect(priceForAmount(1000, 24)).toBe(41.67);
  });
  it("and the line still totals what was typed", () => {
    // 41.67 × 24 = 1000.08 — within the price's rounding, so 1000 stands.
    expect(lineTotalOf(41.67, 24, 1000)).toBe(1000);
  });
  it("holds for a big quantity at a small price", () => {
    // 1000 ÷ 300 = 3.333… → 3.33; 3.33 × 300 = 999 — off by a whole rupee.
    expect(priceForAmount(1000, 300)).toBe(3.33);
    expect(lineTotalOf(3.33, 300, 1000)).toBe(1000);
  });
  it("gives no price without a quantity or an amount", () => {
    expect(priceForAmount(1000, 0)).toBeNull();
    expect(priceForAmount(0, 24)).toBeNull();
  });
});

describe("weighed goods: the amount buys a quantity", () => {
  it("Rs 1000 of milk at Rs 220/kg is 4.55 kg, not 1 kg at Rs 1000", async () => {
    const { amountSetsQuantity, qtyForAmount, lineTotalOf } = await import("@/lib/sell-by-amount");
    expect(amountSetsQuantity("KG")).toBe(true);
    const qty = qtyForAmount(1000, 220)!;
    expect(qty).toBe(4.55);
    // The bill still says what the customer paid.
    expect(lineTotalOf(220, qty, 1000)).toBe(1000);
  });
  it("weights and volumes the shop types; counted goods keep their quantity", async () => {
    const { amountSetsQuantity } = await import("@/lib/sell-by-amount");
    for (const u of ["kg", "Kgs", "g", "gm", "Ltr", "L", "ml"]) expect(amountSetsQuantity(u)).toBe(true);
    for (const u of ["pcs", "Piece", "dozen", "Packet", "", null]) expect(amountSetsQuantity(u)).toBe(false);
  });
});
