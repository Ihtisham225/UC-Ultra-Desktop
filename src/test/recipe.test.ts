import { describe, expect, it } from "vitest";
import { recipeUnitCost, recipeUsage, type IngredientInfo } from "@/lib/recipe";

const ings = new Map<string, IngredientInfo>([
  ["cow", { name: "Cow Milk", unit: "Ltr", cost: 200 }],
  ["buf", { name: "Buffalo Milk", unit: "Ltr", cost: 250 }],
  ["sugar", { name: "Sugar", unit: "kg", cost: 160 }],
  ["cup", { name: "Cup", unit: "pcs", cost: null }],
]);

describe("recipeUsage — what making some of it uses up", () => {
  it("scales a batch recipe by its yield", () => {
    // 50 L of mix milk = 20 L cow + 30 L buffalo; make 10 L.
    const { uses } = recipeUsage(
      [{ ingredient_id: "cow", quantity: 20, unit: "Ltr" }, { ingredient_id: "buf", quantity: 30, unit: "Ltr" }],
      ings, 50, 10,
    );
    expect(uses).toEqual([{ ingredient_id: "cow", quantity: 4 }, { ingredient_id: "buf", quantity: 6 }]);
  });
  it("converts the line's unit to the ingredient's stock unit", () => {
    const { uses } = recipeUsage([{ ingredient_id: "cow", quantity: 200, unit: "ml" }], ings, 1, 3);
    expect(uses).toEqual([{ ingredient_id: "cow", quantity: 0.6 }]);
  });
  it("adds up an ingredient listed twice", () => {
    const { uses } = recipeUsage(
      [{ ingredient_id: "sugar", quantity: 10, unit: "g" }, { ingredient_id: "sugar", quantity: 0.01, unit: "kg" }],
      ings, 1, 1,
    );
    expect(uses).toEqual([{ ingredient_id: "sugar", quantity: 0.02 }]);
  });
  it("reports a unit it can't convert instead of guessing", () => {
    const r = recipeUsage([{ ingredient_id: "cow", quantity: 5, unit: "g" }], ings, 1, 1);
    expect(r.uses).toEqual([]);
    expect(r.unconvertible).toEqual(["Cow Milk"]);
  });
  it("treats a zero yield as one", () => {
    const { uses } = recipeUsage([{ ingredient_id: "cup", quantity: 1, unit: "pcs" }], ings, 0, 2);
    expect(uses).toEqual([{ ingredient_id: "cup", quantity: 2 }]);
  });
});

describe("recipeUnitCost", () => {
  it("costs one unit of a batch recipe", () => {
    // (20×200 + 30×250) / 50 = 230 per litre
    const r = recipeUnitCost(
      [{ ingredient_id: "cow", quantity: 20, unit: "Ltr" }, { ingredient_id: "buf", quantity: 30, unit: "Ltr" }],
      ings, 50,
    );
    expect(r.cost).toBe(230);
  });
  it("keeps tiny quantities — half a gram is not rounded to a gram", () => {
    const r = recipeUnitCost([{ ingredient_id: "sugar", quantity: 0.5, unit: "g" }], ings, 1);
    expect(r.cost).toBe(0.08);
  });
  it("names ingredients that were never bought", () => {
    const r = recipeUnitCost([{ ingredient_id: "cup", quantity: 1, unit: "pcs" }], ings, 1);
    expect(r.cost).toBe(0);
    expect(r.uncosted).toEqual(["Cup"]);
  });
});

import { bookFromRows, expandMadeToOrder, makeableCount } from "@/lib/recipe";

describe("made to order — what a sale takes off the shelf", () => {
  // Chai: 200 ml mix milk + 10 g sugar. Mix milk is batch-made (has stock).
  // Samosa chaat: 1 fried samosa (itself made to order) + 50 g chana.
  // Fried samosa: 1 frozen samosa + 20 ml oil.
  const book = bookFromRows(
    [
      { id: "chai", name: "Chai", unit: "cup", recipe_mode: "at_sale", recipe_yield: "1.000" },
      { id: "mix", name: "Mix Milk", unit: "Ltr", recipe_mode: "batch", recipe_yield: 50 },
      { id: "sugar", name: "Sugar", unit: "kg" },
      { id: "chaat", name: "Samosa Chaat", unit: "plate", recipe_mode: "at_sale", recipe_yield: 1 },
      { id: "fried", name: "Fried Samosa", unit: "pcs", recipe_mode: "at_sale", recipe_yield: 1 },
      { id: "frozen", name: "Frozen Samosa", unit: "pcs" },
      { id: "oil", name: "Oil", unit: "Ltr" },
      { id: "chana", name: "Chana", unit: "kg" },
      { id: "plain", name: "Coca Cola", unit: "pcs" },
    ],
    [
      { product_id: "chai", ingredient_id: "mix", quantity: "200", unit: "ml" },
      { product_id: "chai", ingredient_id: "sugar", quantity: 10, unit: "g" },
      { product_id: "chaat", ingredient_id: "fried", quantity: 1, unit: "pcs" },
      { product_id: "chaat", ingredient_id: "chana", quantity: 50, unit: "g" },
      { product_id: "fried", ingredient_id: "frozen", quantity: 1, unit: "pcs" },
      { product_id: "fried", ingredient_id: "oil", quantity: 20, unit: "ml" },
      { product_id: "mix", ingredient_id: "sugar", quantity: 1, unit: "kg" },
    ],
  );

  it("takes a batch-made ingredient as it is, not its own recipe", () => {
    expect(expandMadeToOrder(book, "chai", 3)!.uses).toEqual([
      { ingredient_id: "mix", quantity: 0.6 },
      { ingredient_id: "sugar", quantity: 0.03 },
    ]);
  });
  it("expands an ingredient that is itself made to order", () => {
    expect(expandMadeToOrder(book, "chaat", 2)!.uses).toEqual([
      { ingredient_id: "frozen", quantity: 2 },
      { ingredient_id: "oil", quantity: 0.04 },
      { ingredient_id: "chana", quantity: 0.1 },
    ]);
  });
  it("is null for anything not made to order", () => {
    expect(expandMadeToOrder(book, "mix", 1)).toBeNull();
    expect(expandMadeToOrder(book, "plain", 1)).toBeNull();
  });
  it("counts how many the shelf can make — the scarcest ingredient decides", () => {
    const stock = new Map([["mix", 1], ["sugar", 5]]);
    expect(makeableCount(book, "chai", (id) => stock.get(id) ?? 0)).toBe(5);
    expect(makeableCount(book, "chai", () => 0)).toBe(0);
    expect(makeableCount(book, "plain", () => 10)).toBeNull();
  });
  it("never shows a negative count", () => {
    expect(makeableCount(book, "chai", (id) => (id === "mix" ? -2 : 5))).toBe(0);
  });
});
