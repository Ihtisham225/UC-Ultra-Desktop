import { describe, expect, it } from "vitest";
import { averageCostsWithRecipes, computePnl } from "@/lib/pnl";
import { productionCostLinesOf } from "@/lib/production";
import { bookFromRows } from "@/lib/recipe";

// Cow milk 200/L, buffalo 250/L. Mix milk is batch-made: 10 L from 4 cow + 6
// buffalo = 2300, so 230/L. Chai is made to order from 200 ml cow milk.
const purchases = [
  { product_id: "cow", variant_id: null, quantity: 10, unit_cost: 200, expense_amount: 0 },
  { product_id: "buf", variant_id: null, quantity: 10, unit_cost: 250, expense_amount: 0 },
];
const runs = [{ product_id: "mix", quantity: "10.00", total_cost: "2300.00" }];
const book = bookFromRows(
  [
    { id: "cow", name: "Cow Milk", unit: "Ltr" },
    { id: "buf", name: "Buffalo Milk", unit: "Ltr" },
    { id: "mix", name: "Mix Milk", unit: "Ltr", recipe_mode: "batch", recipe_yield: 50 },
    { id: "chai", name: "Chai", unit: "cup", recipe_mode: "at_sale", recipe_yield: 1 },
    { id: "kheer", name: "Kheer", unit: "bowl", recipe_mode: "at_sale", recipe_yield: 1 },
    { id: "rice", name: "Rice", unit: "kg" },
  ],
  [
    { product_id: "mix", ingredient_id: "cow", quantity: 20, unit: "Ltr" },
    { product_id: "mix", ingredient_id: "buf", quantity: 30, unit: "Ltr" },
    { product_id: "chai", ingredient_id: "cow", quantity: 200, unit: "ml" },
    { product_id: "kheer", ingredient_id: "rice", quantity: 50, unit: "g" },
  ],
);

describe("cafe costs", () => {
  it("turns a production run into a cost line at its own cost per unit", () => {
    expect(productionCostLinesOf(runs)).toEqual([
      { product_id: "mix", variant_id: null, quantity: 10, unit_cost: 230, expense_amount: 0 },
    ]);
  });
  it("costs batch-made items from their runs and made-to-order items from their recipe", () => {
    const avg = averageCostsWithRecipes([...purchases, ...productionCostLinesOf(runs)], book);
    expect(avg.get("mix")).toBe(230);
    expect(avg.get("chai")).toBeCloseTo(40);
  });
  it("leaves a recipe whose ingredients were never bought uncosted, not free", () => {
    const avg = averageCostsWithRecipes(purchases, book);
    expect(avg.has("kheer")).toBe(false);
  });
  it("puts it all through the P&L — 1 chai and 1 L mix milk cost 270", () => {
    const pnl = computePnl({
      sales: [{
        subtotal: 320, tax: 0, total: 320,
        items: [{ product_id: "chai", quantity: 1, line_total: 80 }, { product_id: "mix", quantity: 1, line_total: 240 }],
      }],
      returns: [],
      purchaseItems: [...purchases, ...productionCostLinesOf(runs)],
      expenses: 0,
      recipes: book,
    });
    expect(pnl.grossProfit).toBeCloseTo(50);
    expect(pnl.uncosted.lines).toBe(0);
  });
});

import { pnlStatement } from "@/lib/pnl";
import { writeOffTotals } from "@/lib/write-offs";

describe("used in the shop and wastage", () => {
  it("totals each kind at cost (synced rows carry text Decimals)", () => {
    expect(writeOffTotals([
      { kind: "use", total_cost: "40.00" },
      { kind: "waste", total_cost: "200.00" },
      { kind: "waste", total_cost: 15.5 },
    ])).toEqual({ shopUse: 40, wastage: 215.5 });
  });
  it("comes off net profit, not gross, and shows as its own lines", () => {
    const pnl = computePnl({
      sales: [{ subtotal: 320, tax: 0, total: 320, items: [{ product_id: "chai", quantity: 1, line_total: 80 }, { product_id: "mix", quantity: 1, line_total: 240 }] }],
      returns: [],
      purchaseItems: [...purchases, ...productionCostLinesOf(runs)],
      expenses: 0,
      recipes: book,
      shopUse: 40,
      wastage: 200,
    });
    expect(pnl.grossProfit).toBeCloseTo(50);
    expect(pnl.netProfit).toBeCloseTo(-190);
    const labels = pnlStatement(pnl).map((r) => r.label);
    expect(labels).toContain("Stock used in the shop");
    expect(labels).toContain("Wastage");
  });
});

import { expandMadeToOrder, makeableCount, recipeModeOf, soldFromIngredients } from "@/lib/recipe";

describe("deals / combos", () => {
  // Chai + Coke for 150: one chai (200 ml cow milk, made to order) and a Coke (stocked).
  const dealBook = bookFromRows(
    [
      { id: "cow", name: "Cow Milk", unit: "Ltr" },
      { id: "coke", name: "Coca Cola", unit: "pcs" },
      { id: "chai", name: "Chai", unit: "cup", recipe_mode: "at_sale", recipe_yield: 1 },
      { id: "deal", name: "Chai + Coke", unit: "pcs", recipe_mode: "deal", recipe_yield: 1 },
    ],
    [
      { product_id: "chai", ingredient_id: "cow", quantity: 200, unit: "ml" },
      { product_id: "deal", ingredient_id: "chai", quantity: 1, unit: "cup" },
      { product_id: "deal", ingredient_id: "coke", quantity: 1, unit: "pcs" },
    ],
  );

  it("is a recipe mode that sells from what's in it", () => {
    expect(recipeModeOf("deal")).toBe("deal");
    expect(soldFromIngredients("deal")).toBe(true);
    expect(soldFromIngredients("batch")).toBe(false);
  });
  it("takes each product in it off stock, expanding a made-to-order one", () => {
    expect(expandMadeToOrder(dealBook, "deal", 2)!.uses).toEqual([
      { ingredient_id: "cow", quantity: 0.4 },
      { ingredient_id: "coke", quantity: 2 },
    ]);
  });
  it("can make as many as the scarcest item allows", () => {
    const stock = new Map([["cow", 34.6], ["coke", 94]]);
    expect(makeableCount(dealBook, "deal", (id) => stock.get(id) ?? 0)).toBe(94);
  });
  it("is costed from what's in it", () => {
    const avg = averageCostsWithRecipes(
      [
        { product_id: "cow", variant_id: null, quantity: 10, unit_cost: 200, expense_amount: 0 },
        { product_id: "coke", variant_id: null, quantity: 10, unit_cost: 70, expense_amount: 0 },
      ],
      dealBook,
    );
    expect(avg.get("deal")).toBeCloseTo(110);
  });
});
