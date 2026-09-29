import { describe, it, expect } from "vitest";
import { productMovement, movementTotals } from "@/lib/product-movement";

const products = [
  { id: "oil", name: "Engine Oil", unit: "L", stock: 40, low_stock_threshold: 5 },
  { id: "shirt", name: "Shirt", stock: 0 },
  { id: "idle", name: "Filter", stock: 12 },
  { id: "svc", name: "Oil change labour", is_service: true, stock: 0 },
  { id: "old", name: "Archived", is_active: false, stock: 3 },
];
const variants = [
  { id: "s-m", product_id: "shirt", name: "M", stock: 2, low_stock_threshold: 3 },
  { id: "s-l", product_id: "shirt", name: "L", stock: 0 },
];

describe("sold & left", () => {
  const rows = productMovement({
    products, variants,
    sold: [
      { product_id: "oil", quantity: 3.7, line_total: 3700 },
      { product_id: "oil", quantity: 2, line_total: 2000 },
      { product_id: "shirt", variant_id: "s-m", quantity: 4, line_total: 4000 },
      { product_id: "svc", quantity: 1, line_total: 500 },
      { product_id: "gone", product_name: "Deleted thing", quantity: 1, line_total: 100 },
      { product_id: "old", quantity: 1, line_total: 50 },
    ],
    returned: [{ product_id: "shirt", variant_id: "s-m", quantity: 1, line_total: 1000 }],
    bought: [{ product_id: "oil", quantity: 50 }],
  });
  const by = (key: string) => rows.find((r) => r.key === key)!;

  it("adds up a product's lines, fractions included, and keeps today's stock", () => {
    expect(by("oil")).toMatchObject({ bought: 50, sold: 5.7, net_sold: 5.7, sales_value: 5700, left: 40, unit: "L" });
  });
  it("a product with variants is one row per variant, and returns come off", () => {
    expect(by("s-m")).toMatchObject({ name: "Shirt — M", sold: 4, returned: 1, net_sold: 3, sales_value: 3000, left: 2, low: true });
    expect(by("s-l")).toMatchObject({ net_sold: 0, left: 0 });
    expect(rows.find((r) => r.key === "shirt")).toBeUndefined();
  });
  it("lists what didn't sell, holds no stock for a service, and still shows lines for archived or deleted products", () => {
    expect(by("idle")).toMatchObject({ net_sold: 0, left: 12 });
    expect(by("svc")).toMatchObject({ sold: 1, left: null, is_service: true });
    expect(by("gone")).toMatchObject({ name: "Deleted thing", sold: 1, left: null });
    expect(by("old")).toMatchObject({ name: "Archived", sold: 1, left: 3 });
  });
  it("sorts best sellers first and totals the page", () => {
    expect(rows[0].key).toBe("oil");
    const t = movementTotals(rows);
    expect(t.units_sold).toBe(5.7 + 3 + 1 + 1 + 1);
    expect(t.units_returned).toBe(1);
    expect(t.products_sold).toBe(5);
    expect(t.not_moving).toBe(1); // the filter
  });
});

describe("opening stock", () => {
  it("makes every row add up: Opening + Bought − Net sold = Left now (Tech Town, 3 in 1 Cable)", () => {
    const [row] = productMovement({
      products: [{ id: "cable", name: "3 in 1 Cable", unit: "pcs", stock: 2973 }],
      variants: [],
      sold: [1, 1, 30].map((q) => ({ product_id: "cable", quantity: q, line_total: q * 250 })),
      returned: [{ product_id: "cable", quantity: 1, line_total: 250 }],
      bought: [500, 500, 500, 1000, 500].map((q) => ({ product_id: "cable", quantity: q })),
    });
    expect(row).toMatchObject({ bought: 3000, net_sold: 31, left: 2973, opening: 4 });
    expect(row.opening! + row.bought - row.net_sold).toBe(row.left);
  });
  it("has no opening for a service", () => {
    const [row] = productMovement({ products: [{ id: "s", name: "Labour", is_service: true }], variants: [], sold: [], returned: [], bought: [] });
    expect(row.opening).toBeNull();
  });
});
