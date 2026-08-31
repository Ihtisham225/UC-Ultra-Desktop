/**
 * Oil shops (store_type "oil") change engine oil, usually free, and sell the
 * oil itself. Two things make them different from a normal counter:
 *
 *  - The visit is worth more to them than the sale. Every car that comes in is
 *    written down — plate, make, odometer, when it's due back, whose it is —
 *    so they can call the customer when the next change falls due.
 *  - They sell by volume. Stock is held in litres and leaves as bottles and
 *    drums, so the unit is chosen at the till, not fixed on the product.
 *
 * Ask this rather than comparing `store_type` by hand, so the rule lives in
 * one place.
 */
export function isOil(shop?: { store_type?: string | null } | null): boolean {
  return shop?.store_type === "oil";
}

/**
 * Plates are written down a dozen ways — "LEA 07-1234", "lea071234",
 * "LEA-07 1234" — and all of them are the same car. Compare and look up on
 * this form so a returning vehicle finds its own history.
 */
export function normalizePlate(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * How the plate is shown back: exactly what the counter typed, just tidied of
 * doubled spaces. We keep their formatting because that's what's on the car.
 */
export function tidyPlate(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * The base units an oil shop is likely to stock in, offered as suggestions on
 * the product form. Free text still wins — this is a shortcut, not a list of
 * what's allowed.
 */
export const OIL_UNIT_SUGGESTIONS = ["litre", "ml", "pcs", "kg", "drum"];

/**
 * A vehicle is due when its odometer has passed the reading the last change
 * was good until. We can't read odometers, so "due" here means the last
 * recorded visit set a next_km and enough distance is *likely* covered — the
 * screen sorts by it and the shop makes the call.
 */
export function kmRemaining(currentKm?: number | null, nextKm?: number | null): number | null {
  if (currentKm == null || nextKm == null) return null;
  return nextKm - currentKm;
}
