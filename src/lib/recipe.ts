import { convertQty } from "./units";

/**
 * Recipes (cafe shops). A product made from other products — mix milk from cow
 * and buffalo milk, kheer from milk, a fried samosa from a frozen one and oil.
 *
 * ⚠️ Pure and COPIED verbatim to the desktop (src/lib/recipe.ts there, pinned
 * by src/test/recipe.test.ts): the till works out what a made-to-order sale
 * uses up while offline, and the server works out the same for production
 * runs, so both must read a recipe the same way.
 */

/**
 * How a recipe uses up stock. null = the product has no recipe.
 * "deal" is a combo (Samosa + Chai for Rs 150): sold exactly like a
 * made-to-order item, its "ingredients" being the products in it.
 */
export type RecipeMode = "at_sale" | "batch" | "deal";

/** Made to order or a deal: holds no stock, and its contents leave stock when it is sold. */
export const soldFromIngredients = (mode: string | null | undefined) => mode === "at_sale" || mode === "deal";

export const RECIPE_MODES: { value: RecipeMode; label: string; hint: string }[] = [
  {
    value: "at_sale",
    label: "Made to order",
    hint: "Ingredients leave stock when it is sold — fried samosa, chaat, a cup of chai.",
  },
  {
    value: "batch",
    label: "Made in batches",
    hint: "Made ahead in a production run that adds to its own stock — mix milk, kheer, cake.",
  },
  {
    value: "deal",
    label: "Deal / combo",
    hint: "A fixed-price bundle of other products — Samosa + Chai for Rs 150.",
  },
];

export function recipeModeOf(raw: string | null | undefined): RecipeMode | null {
  return raw === "at_sale" || raw === "batch" || raw === "deal" ? raw : null;
}

export interface RecipeLineInput {
  ingredient_id: string;
  /** For `recipe_yield` of the product, in `unit`. */
  quantity: number;
  unit: string;
}

export interface IngredientInfo {
  name: string;
  /** The ingredient's stock unit (products.unit). */
  unit: string | null;
  /** Average landed cost per stock unit, when it has ever been bought. */
  cost?: number | null;
}

export interface RecipeUse {
  ingredient_id: string;
  /** In the ingredient's own stock unit. */
  quantity: number;
}

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** Never divide by a missing or zero yield — treat it as one. */
export const safeYield = (y: unknown) => (n(y) > 0 ? n(y) : 1);

/**
 * What making `made` of the product uses up, in each ingredient's stock unit.
 * Lines whose unit can't be converted to the ingredient's (grams of something
 * held in litres) are returned in `unconvertible` rather than guessed at.
 */
export function recipeUsage(
  lines: RecipeLineInput[],
  ingredients: Map<string, IngredientInfo>,
  recipeYield: unknown,
  made: number,
): { uses: RecipeUse[]; unconvertible: string[] } {
  const per = made / safeYield(recipeYield);
  const totals = new Map<string, number>();
  const unconvertible: string[] = [];
  for (const l of lines) {
    const ing = ingredients.get(l.ingredient_id);
    if (!ing) continue;
    const q = convertQty(n(l.quantity) * per, l.unit, ing.unit);
    if (q === null) {
      unconvertible.push(ing.name);
      continue;
    }
    totals.set(l.ingredient_id, (totals.get(l.ingredient_id) ?? 0) + q);
  }
  const uses = [...totals].map(([ingredient_id, quantity]) => ({
    ingredient_id,
    // Stock is held to 2 places in the database; keep 3 here so 0.2 L × 3 doesn't drift.
    quantity: Math.round(quantity * 1000) / 1000,
  }));
  return { uses, unconvertible };
}

/**
 * Ingredient cost of ONE unit of the product. `uncosted` names ingredients
 * never bought through a purchase — they count as 0, so the figure is low.
 */
export function recipeUnitCost(
  lines: RecipeLineInput[],
  ingredients: Map<string, IngredientInfo>,
  recipeYield: unknown,
): { cost: number; uncosted: string[]; unconvertible: string[] } {
  // Not via recipeUsage: its rounding would turn half a gram of elaichi into
  // a whole one when only one unit is being costed.
  const per = 1 / safeYield(recipeYield);
  let cost = 0;
  const uncosted: string[] = [];
  const unconvertible: string[] = [];
  for (const l of lines) {
    const ing = ingredients.get(l.ingredient_id);
    if (!ing) continue;
    const q = convertQty(n(l.quantity) * per, l.unit, ing.unit);
    if (q === null) unconvertible.push(ing.name);
    else if (ing.cost == null || !(ing.cost > 0)) uncosted.push(ing.name);
    else cost += q * ing.cost;
  }
  return { cost: Math.round(cost * 100) / 100, uncosted, unconvertible };
}

/** Every recipe in a shop, and every product they name — what a sale needs to read a recipe. */
export interface RecipeBook {
  recipes: Map<string, { mode: RecipeMode; yield: number; lines: RecipeLineInput[] }>;
  /** Name and stock unit of every product a recipe uses. */
  ingredients: Map<string, IngredientInfo>;
}

/**
 * What selling `qty` of a MADE-TO-ORDER product takes off the shelf, in each
 * ingredient's stock unit. An ingredient that is itself made to order holds
 * no stock, so it is expanded into its own ingredients (a samosa chaat made
 * with a fried samosa takes the frozen samosa and the oil). A batch-made
 * ingredient (mix milk) has stock of its own and is taken as it is.
 *
 * Null when the product isn't made to order — the caller moves its own stock.
 */
export function expandMadeToOrder(
  book: RecipeBook,
  productId: string,
  qty: number,
  depth = 0,
): { uses: RecipeUse[]; unconvertible: string[] } | null {
  const r = book.recipes.get(productId);
  if (!r || !soldFromIngredients(r.mode)) return null;
  const { uses, unconvertible } = recipeUsage(r.lines, book.ingredients, r.yield, qty);
  const totals = new Map<string, number>();
  const bad = [...unconvertible];
  for (const u of uses) {
    // writeRecipe refuses cycles; the depth cap is only a guard against old data.
    const nested = depth < 5 ? expandMadeToOrder(book, u.ingredient_id, u.quantity, depth + 1) : null;
    if (nested) {
      bad.push(...nested.unconvertible);
      for (const nu of nested.uses) totals.set(nu.ingredient_id, (totals.get(nu.ingredient_id) ?? 0) + nu.quantity);
    } else {
      totals.set(u.ingredient_id, (totals.get(u.ingredient_id) ?? 0) + u.quantity);
    }
  }
  return {
    uses: [...totals].map(([ingredient_id, quantity]) => ({ ingredient_id, quantity: Math.round(quantity * 1000) / 1000 })),
    unconvertible: bad,
  };
}

/**
 * How many of a made-to-order product the ingredients on the shelf can make —
 * shown as its stock at the till, so the till's usual out-of-stock rules
 * (and the shop's "allow negative stock" switch) apply to it unchanged.
 * Null when the product isn't made to order.
 */
export function makeableCount(book: RecipeBook, productId: string, stockOf: (id: string) => number): number | null {
  // Expanded for a round dozen, not one: a 0.0005 kg pinch would round to
  // nothing per piece and make the count infinite.
  const e = expandMadeToOrder(book, productId, 12);
  if (!e) return null;
  const uses = e.uses.filter((u) => u.quantity > 0);
  if (!uses.length) return 0;
  const n = Math.min(...uses.map((u) => (stockOf(u.ingredient_id) / u.quantity) * 12));
  return Math.max(0, Math.floor(n + 1e-9));
}

/**
 * A RecipeBook from synced rows (snake_case, as the desktop's store holds
 * them; Decimals may arrive as text). The server builds the same thing from
 * Prisma in lib/recipe-server — this is the offline till's version.
 */
export function bookFromRows(
  products: { id: string; name: string; unit?: string | null; recipe_mode?: string | null; recipe_yield?: number | string | null }[],
  lines: { product_id: string; ingredient_id: string; quantity: number | string; unit: string; sort_order?: number | null }[],
): RecipeBook {
  const book: RecipeBook = { recipes: new Map(), ingredients: new Map() };
  for (const p of products) {
    book.ingredients.set(p.id, { name: p.name, unit: p.unit ?? null });
    const mode = recipeModeOf(p.recipe_mode);
    if (mode) book.recipes.set(p.id, { mode, yield: safeYield(p.recipe_yield), lines: [] });
  }
  const sorted = [...lines].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  for (const l of sorted) {
    book.recipes.get(l.product_id)?.lines.push({ ingredient_id: l.ingredient_id, quantity: n(l.quantity), unit: l.unit });
  }
  return book;
}
