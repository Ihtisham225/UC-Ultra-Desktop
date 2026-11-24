import { describe, it, expect } from "vitest";
import { productMatchesSearch, searchProducts } from "@/lib/product-search";

// SHAMSHER CORPORATION, 2026-11-24: typing "3119" also listed "3001 BT Polyster",
// whose barcode 806311939900 holds the digits 3119 in its middle.
const a = { name: "3001 BT Polyster", barcode: "806311939900", sku: "3001-BT-M31A" };
const b = { name: "3119 BT Polyester", barcode: "808688654527", sku: "3119-BT-8HNK" };

describe("product search", () => {
  it("does not match a code in the middle of another product's barcode", () => {
    expect(searchProducts([a, b], "3119")).toEqual([b]);
  });
  it("still finds a product by its full barcode, or the start of it", () => {
    expect(searchProducts([a, b], "806311939900")).toEqual([a]);
    expect(searchProducts([a, b], "8063")).toEqual([a]);
  });
  it("matches SKUs from the start only", () => {
    expect(productMatchesSearch(a, "3001-bt")).toBe(true);
    expect(productMatchesSearch(a, "m31a")).toBe(false);
  });
  it("matches every typed word in the name, in any order", () => {
    expect(productMatchesSearch(b, "polyester 3119")).toBe(true);
    expect(productMatchesSearch(b, "polyester 3001")).toBe(false);
  });
  it("matches product and variant words together", () => {
    const shirt = { name: "Shirt", variants: [{ name: "Large", barcode: "111222" }] };
    expect(productMatchesSearch(shirt, "shirt large")).toBe(true);
    expect(productMatchesSearch(shirt, "111")).toBe(true);
    expect(productMatchesSearch(shirt, "222")).toBe(false);
  });
  it("puts an exact code hit first", () => {
    const named = { name: "Cable 808688654527 pack" };
    expect(searchProducts([named, b], "808688654527")[0]).toBe(b);
  });
});
