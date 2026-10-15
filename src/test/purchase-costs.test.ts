import { describe, expect, it } from "vitest";
import { costBaseFor, priceFromMarkup, markupFromPrice } from "@/lib/purchase-costs";

describe("costBaseFor — the cost a markup is put on", () => {
  const costs = { latest: 280, previous: 250 };

  it("starts from the cost saved on the product, even after a newer purchase", () => {
    expect(costBaseFor(undefined, 300, costs)).toBe(300);
  });

  it("falls back to the latest purchase when nothing is saved", () => {
    expect(costBaseFor(undefined, null, costs)).toBe(280);
    expect(costBaseFor(undefined, undefined, { latest: null, previous: 250 })).toBe(250);
    expect(costBaseFor(undefined, null, null)).toBeNull();
  });

  it("uses what was typed, and a cleared box means no cost", () => {
    expect(costBaseFor(320, 300, costs)).toBe(320);
    expect(costBaseFor(null, 300, costs)).toBeNull();
  });

  it("matches the screenshot: 280 at 42.86% sells for 400", () => {
    expect(priceFromMarkup(280, 42.86)).toBe(400.01);
    expect(markupFromPrice(280, 400)).toBe(42.86);
  });
});
