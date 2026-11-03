import { describe, expect, it } from "vitest";
import { convertQty, normalizeUnit, unitChoices, unitLabel } from "@/lib/units";

describe("normalizeUnit — what shops type", () => {
  it("folds the usual spellings", () => {
    expect(normalizeUnit("Ltr")).toBe("l");
    expect(normalizeUnit("litre")).toBe("l");
    expect(normalizeUnit("KG")).toBe("kg");
    expect(normalizeUnit("gm")).toBe("g");
    expect(normalizeUnit("pcs")).toBe("pcs");
    expect(normalizeUnit("Piece")).toBe("pcs");
  });
  it("leaves the shop's own words alone", () => {
    expect(normalizeUnit("Packet")).toBeNull();
    expect(normalizeUnit("")).toBeNull();
  });
});

describe("convertQty", () => {
  it("converts within a kind", () => {
    expect(convertQty(200, "ml", "Ltr")).toBeCloseTo(0.2);
    expect(convertQty(1.5, "kg", "g")).toBe(1500);
    expect(convertQty(2, "dozen", "pcs")).toBe(24);
  });
  it("refuses across kinds — grams of milk held in litres would use nothing", () => {
    expect(convertQty(1, "g", "l")).toBeNull();
    expect(convertQty(1, "pcs", "kg")).toBeNull();
  });
  it("treats unknown units as equal only when they are the same word", () => {
    expect(convertQty(3, "Packet", "packet")).toBe(3);
    expect(convertQty(3, "Packet", "Box")).toBeNull();
    expect(convertQty(3, "Packet", "pcs")).toBeNull();
  });
});

describe("unitChoices — the recipe line's unit list", () => {
  it("offers the stock unit first, as spelt, then the rest of its kind", () => {
    expect(unitChoices("Ltr")).toEqual(["Ltr", "ml"]);
    expect(unitChoices("kg")).toEqual(["kg", "mg", "g"]);
  });
  it("offers only the shop's own word for an unknown unit", () => {
    expect(unitChoices("Packet")).toEqual(["Packet"]);
  });
  it("labels litres as L", () => {
    expect(unitLabel("ltr")).toBe("L");
  });
});
