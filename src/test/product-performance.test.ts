import { describe, it, expect } from "vitest";
import { productMovement } from "@/lib/product-movement";
import { productPerformance, rankPerformance, performanceTotals } from "@/lib/product-performance";
import { catalogMatcher } from "@/lib/sales-report";

const categories = [
  { id: "oil", name: "Oil", parent_id: null },
  { id: "engine", name: "Engine oil", parent_id: "oil" },
  { id: "filters", name: "Filters", parent_id: null },
];
const brands = [{ id: "shell", name: "Shell" }, { id: "total", name: "Total" }];
const products = [
  { id: "p1", name: "Shell Helix", stock: 10, category_id: "engine", brand_id: "shell" },
  { id: "p2", name: "Total Quartz", stock: 5, category_id: "engine", brand_id: "total" },
  { id: "p3", name: "Air filter", stock: 7, category_id: "filters", brand_id: null },
  { id: "p4", name: "Idle thing", stock: 3, category_id: "filters", brand_id: null },
];
const rows = productMovement({
  products,
  variants: [],
  sold: [
    { product_id: "p1", quantity: 4, line_total: 4000 },
    { product_id: "p2", quantity: 6, line_total: 3000 },
    { product_id: "p3", quantity: 2, line_total: 600 },
  ],
  returned: [{ product_id: "p2", quantity: 1, line_total: 500 }],
  bought: [],
});
const costs = { p1: 700, p2: 300 }; // p3 never bought: cost unknown

describe("product performance", () => {
  it("works out profit at average cost, net of returns", () => {
    const perf = productPerformance(rows, costs, categories, brands, "product");
    const p2 = perf.find((r) => r.key === "p2")!;
    expect(p2.sold).toBe(5);
    expect(p2.sales_value).toBe(2500);
    expect(p2.cost).toBe(1500);
    expect(p2.profit).toBe(1000);
    const p3 = perf.find((r) => r.key === "p3")!;
    expect(p3.profit).toBeNull();
    expect(p3.uncosted).toBe(2);
  });
  it("ranks best sellers, most profit and what isn't selling", () => {
    const perf = productPerformance(rows, costs, categories, brands, "product");
    expect(rankPerformance(perf, "most_qty").map((r) => r.key)).toEqual(["p2", "p1", "p3"]);
    expect(rankPerformance(perf, "most_profit").map((r) => r.key)).toEqual(["p1", "p2"]);
    expect(rankPerformance(perf, "not_selling").map((r) => r.key)).toEqual(["p4"]);
  });
  it("narrows to a parent category including its children, and to a brand", () => {
    const inOil = rows.filter(catalogMatcher({ category: "oil", brand: "" }, categories, brands));
    expect(inOil.map((r) => r.key).sort()).toEqual(["p1", "p2"]);
    const shell = rows.filter(catalogMatcher({ category: "oil", brand: "shell" }, categories, brands));
    expect(rankPerformance(productPerformance(shell, costs, categories, brands, "product"), "most_qty")[0].name).toBe("Shell Helix");
  });
  it("rolls up by category and brand", () => {
    const byCat = productPerformance(rows, costs, categories, brands, "category");
    const engine = byCat.find((r) => r.key === "engine")!;
    expect(engine.products).toBe(2);
    expect(engine.sold).toBe(9);
    expect(engine.sales_value).toBe(6500);
    const totals = performanceTotals(productPerformance(rows, costs, categories, brands, "product"));
    expect(totals.units).toBe(11);
    expect(totals.profit).toBe(2200);
  });
});
