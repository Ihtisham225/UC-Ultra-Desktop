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
