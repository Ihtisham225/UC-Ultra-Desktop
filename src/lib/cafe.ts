/**
 * Cafes (store_type "cafe") buy raw materials — cow and buffalo milk, almonds,
 * elaichi, frozen samosa — and ready-made goods, then turn the raw ones into
 * what they sell: mix milk, kheer, cake, a fried samosa, a plate of chaat.
 * Some of what they buy is never sold at all (cups, shopping bags).
 *
 * So a cafe's products carry two things other shops don't need:
 *  - "Sold at the till" (products.is_sellable), off for raw and shop-use items;
 *  - a recipe (product_recipe_lines, lib/recipe), made to order or in batches.
 *
 * Ask this rather than comparing `store_type` by hand, so the rule lives in
 * one place.
 */
export function isCafe(shop?: { store_type?: string | null } | null): boolean {
  return shop?.store_type === "cafe";
}

/**
 * Settings → Shop: does this cafe build its products from recipes? Many don't —
 * ingredient prices move and keeping recipes in step needs someone on it. Off,
 * a product is one of three simple kinds (see CafeProductKind). Missing (older
 * payloads) means yes, the original behaviour.
 */
export function usesRecipes(shop?: { store_type?: string | null; cafe_recipes?: boolean | null } | null): boolean {
  return isCafe(shop) && shop?.cafe_recipes !== false;
}

/**
 * Settings → Shop: raw materials (lib/raw-materials) — the Raw materials page,
 * "Add material" on purchases and the "Raw material" product kind. Cafes only;
 * missing (older payloads) means on.
 */
export function usesRawMaterials(shop?: { store_type?: string | null; raw_materials_enabled?: boolean | null } | null): boolean {
  return isCafe(shop) && shop?.raw_materials_enabled !== false;
}

/**
 * A cafe product when the shop doesn't use recipes:
 *  - "bought"   — bought and sold as it is (milk, eggs, oil); stock tracked.
 *  - "on_spot"  — made on the spot (tea, fries, noodles); a typed cost, no
 *                 stock, sells without limit. Stored as a service.
 *  - "prepared" — prepared ahead (cake, kheer); a typed cost, stock added when
 *                 a batch is made (Production) and taken off as it sells.
 *                 Stored as a batch recipe with no ingredients.
 *  - "raw"      — a raw material (sugar, spices, cups): bought, never sold.
 *                 Stored with "Sold at the till" off; counted or not
 *                 (lib/raw-materials).
 */
export type CafeProductKind = "bought" | "on_spot" | "prepared" | "raw";

export function cafeKindOf(p: { is_service?: boolean | null; recipe_mode?: string | null; is_sellable?: boolean | null }): CafeProductKind {
  if (p.is_sellable === false) return "raw";
  if (p.is_service) return "on_spot";
  if (p.recipe_mode === "batch") return "prepared";
  return "bought";
}

export const CAFE_KINDS: { value: CafeProductKind; label: string; hint: string }[] = [
  { value: "bought", label: "Bought and sold", hint: "Cow milk, organic eggs, oil — bought in and sold as it is. Stock is tracked." },
  { value: "on_spot", label: "Made on the spot", hint: "Tea, fries, samosa, noodles — set what one costs you and sell it. No stock to keep." },
  { value: "prepared", label: "Prepared ahead", hint: "Cake, kheer — set what one costs you. Add to stock from Production when you make a batch; selling takes it off." },
  { value: "raw", label: "Raw material", hint: "Sugar, spices, cups — bought, never sold. Keep count of it, or not." },
];
