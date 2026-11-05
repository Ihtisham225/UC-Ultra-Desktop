import { describe, expect, it } from "vitest";
import { rawMaterialRows, untrackedMaterialsCost } from "@/lib/raw-materials";
import { cafeKindOf, usesRawMaterials } from "@/lib/cafe";
import { computePnl } from "@/lib/pnl";

const products = [
  { id: "sugar", name: "Sugar", unit: "kg", stock: "2", is_service: false, is_sellable: false },
  { id: "salt", name: "Salt", unit: "kg", stock: "0", is_service: true, is_sellable: false },
  { id: "tea", name: "Tea", unit: "cup", stock: "0", is_service: true, is_sellable: true },
];
const purchases = [
  { id: "p1", created_at: "2026-11-05T05:00:00.000Z" },
  { id: "p0", created_at: "2026-10-01T05:00:00.000Z" },
];
const items = [
  { purchase_id: "p1", product_id: "sugar", quantity: "2", unit_cost: "150", line_total: "300" },
  { purchase_id: "p1", product_id: "salt", quantity: "1", unit_cost: "500", line_total: "500", expense_amount: "20" },
  { purchase_id: "p0", product_id: "salt", quantity: "1", unit_cost: "400", line_total: "400" },
];
const from = "2026-11-01T00:00:00.000Z";
const to = "2026-11-30T23:59:59.999Z";

describe("raw materials", () => {
  it("lists only products not sold at the till, with what was bought in the period", () => {
    const rows = rawMaterialRows(products, purchases, items, from, to);
    expect(rows.map((r) => r.id)).toEqual(["salt", "sugar"]);
    expect(rows.find((r) => r.id === "sugar")).toMatchObject({ tracked: true, stock: 2, bought_qty: 2, bought_cost: 300 });
    expect(rows.find((r) => r.id === "salt")).toMatchObject({ tracked: false, stock: null, bought_cost: 520 });
  });

  it("costs untracked materials at what was paid in the period — tracked ones and other months excluded", () => {
    expect(untrackedMaterialsCost(products, purchases, items, from, to)).toBe(520);
  });

  it("puts that cost below gross profit in the P&L", () => {
    const p = computePnl({ sales: [], returns: [], purchaseItems: [], expenses: 100, rawMaterials: 520 });
    expect(p.rawMaterials).toBe(520);
    expect(p.overheads).toBe(620);
    expect(p.netProfit).toBe(-620);
  });

  it("is a cafe switch, on unless turned off", () => {
    expect(usesRawMaterials({ store_type: "cafe" })).toBe(true);
    expect(usesRawMaterials({ store_type: "cafe", raw_materials_enabled: false })).toBe(false);
    expect(usesRawMaterials({ store_type: "other" })).toBe(false);
  });

  it("reads a not-sold product as a raw material, whatever else it is", () => {
    expect(cafeKindOf({ is_sellable: false, is_service: true })).toBe("raw");
    expect(cafeKindOf({ is_sellable: true, is_service: true })).toBe("on_spot");
  });
});
