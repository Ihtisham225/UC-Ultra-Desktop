import { describe, expect, it } from "vitest";
import { cafeKindOf, usesRecipes } from "@/lib/cafe";
import { typedCostLinesOf, productionCostLinesOf } from "@/lib/production";
import { computePnl } from "@/lib/pnl";
import { recipeForSave } from "@/components/RecipeBuilder";

describe("cafe without recipes", () => {
  it("is on by default, off only when the shop says so", () => {
    expect(usesRecipes({ store_type: "cafe" })).toBe(true);
    expect(usesRecipes({ store_type: "cafe", cafe_recipes: false })).toBe(false);
    expect(usesRecipes({ store_type: "other", cafe_recipes: true })).toBe(false);
  });

  it("reads a product's kind from its columns", () => {
    expect(cafeKindOf({ is_service: true })).toBe("on_spot");
    expect(cafeKindOf({ recipe_mode: "batch" })).toBe("prepared");
    expect(cafeKindOf({})).toBe("bought");
  });

  it("lets a prepared item save as a batch with no ingredients", () => {
    expect(recipeForSave({ mode: "batch", yield: "1", lines: [] })).toEqual({ mode: "batch", yield: 1, lines: [] });
    // Made to order still needs its ingredients.
    expect("error" in recipeForSave({ mode: "at_sale", yield: "1", lines: [] })).toBe(true);
  });

  it("costs tea at its typed cost and kheer at its batch cost", () => {
    const p = computePnl({
      sales: [{ subtotal: 230, tax: 0, total: 230, items: [
        { product_id: "tea", quantity: 3, line_total: 150 },
        { product_id: "kheer", quantity: 2, line_total: 80 },
      ] }],
      returns: [],
      expenses: 0,
      purchaseItems: [
        ...typedCostLinesOf([{ id: "tea", is_service: true, current_cost: "35" }]),
        ...productionCostLinesOf([{ product_id: "kheer", quantity: 10, total_cost: 300 }]),
      ],
      serviceIds: new Set(["tea"]),
    });
    expect(p.grossProfit).toBe(65); // 230 − (3 × 35 + 2 × 30)
    expect(p.uncosted.lines).toBe(0);
  });

  it("leaves services with no cost (lab tests, labour) costless as before", () => {
    expect(typedCostLinesOf([{ id: "cbc", is_service: true, current_cost: null }])).toEqual([]);
    expect(typedCostLinesOf([{ id: "milk", is_service: false, current_cost: 200 }])).toEqual([]);
  });
});
