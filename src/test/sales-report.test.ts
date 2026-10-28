import { describe, expect, it } from "vitest";
import { filterOptions, filterSales, NONE, rankSales, type SalesReportBill } from "@/lib/sales-report";

const cats = [
  { id: "oil", name: "Oil", parent_id: null },
  { id: "engine", name: "Engine oil", parent_id: "oil" },
  { id: "filters", name: "Filters", parent_id: null },
];
const brands = [{ id: "shell", name: "Shell" }];
const line = (o: Partial<SalesReportBill["sale_items"][number]>) => ({
  product_id: "p", variant_id: null, product_name: "X", quantity: 1, line_total: 100, ...o,
});
const bills: SalesReportBill[] = [
  { id: "b1", total: 1000, subtotal: 1000, tax: 0, discount: 0, sale_items: [
    line({ product_id: "p1", product_name: "Helix 4L", quantity: 2, line_total: 800, category_id: "engine", brand_id: "shell" }),
    line({ product_id: "p2", product_name: "Air filter", quantity: 1, line_total: 200, category_id: "filters" }),
  ] },
  { id: "b2", total: 500, subtotal: 500, tax: 0, discount: 0, sale_items: [
    line({ product_id: "p1", product_name: "Helix 4L", quantity: 1, line_total: 400, category_id: "engine", brand_id: "shell" }),
    line({ product_id: "p3", product_name: "Rag", quantity: 5, line_total: 100, category: "Misc" }),
  ] },
];
const all = { category: "", brand: "", product: "" };

describe("sales report filters", () => {
  it("without a filter uses bill totals; average = revenue ÷ bills", () => {
    const { stats } = filterSales(bills, all, cats, brands);
    expect(stats).toMatchObject({ revenue: 1500, bills: 2, items: 9, average: 750 });
  });

  it("a parent category takes in its children, counting only matching lines", () => {
    const { bills: kept, stats } = filterSales(bills, { ...all, category: "oil" }, cats, brands);
    expect(kept.map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(stats).toMatchObject({ revenue: 1200, items: 3, average: 600 });
  });

  it("filters by brand, by free-text category and by 'no brand'", () => {
    expect(filterSales(bills, { ...all, brand: "shell" }, cats, brands).stats.revenue).toBe(1200);
    expect(filterSales(bills, { ...all, category: "name:misc" }, cats, brands).bills.map((b) => b.id)).toEqual(["b2"]);
    expect(filterSales(bills, { ...all, brand: NONE }, cats, brands).stats.revenue).toBe(300);
  });

  it("ranks most and least sold, by product and by category", () => {
    expect(rankSales(bills, all, cats, brands, "product", "most_qty").map((r) => r.name)).toEqual(["Rag", "Helix 4L", "Air filter"]);
    expect(rankSales(bills, all, cats, brands, "product", "least_qty")[0].name).toBe("Air filter");
    const byCat = rankSales(bills, all, cats, brands, "category", "most_revenue");
    expect(byCat.map((r) => [r.name, r.revenue, r.bills])).toEqual([["Engine oil", 1200, 2], ["Filters", 200, 1], ["Misc", 100, 1]]);
  });

  it("lists categories as a tree plus labels only products carry", () => {
    const o = filterOptions(bills, cats, brands);
    expect(o.categories.map((c) => [c.label, c.depth ?? 0])).toEqual([["Oil", 0], ["Engine oil", 1], ["Filters", 0], ["Misc", 0]]);
    expect(o.brands.map((b) => b.label)).toEqual(["Shell", "No brand"]);
  });
});
