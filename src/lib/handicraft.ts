/**
 * Handicraft shops (shawl makers) use the app as a register, not as a till.
 * They buy raw material from several parties, send the finished goods out to a
 * factory for bumbul / rangai / dhulai / press, and take them back on a second
 * bill — but they never sell through the app, hold no stock in it, and keep no
 * product catalogue.
 *
 * Everything selling- or stock-shaped is therefore hidden for them. Ask this
 * rather than comparing `store_type` by hand, so the rule lives in one place.
 */
export function isHandicraft(
  shop?: { store_type?: string | null } | null,
): boolean {
  return shop?.store_type === "handicraft";
}

/** What a party is to a handicraft shop. */
export type PartyRoleValue = "supplier" | "processor" | "both";

export const PARTY_ROLE_LABEL: Record<PartyRoleValue, string> = {
  supplier: "Supplier — sells material",
  processor: "Processing company — does the work",
  both: "Both",
};

/** Does this party sell material? (Used to filter the purchase pickers.) */
export const isMaterialSupplier = (role?: string | null) =>
  role === "supplier" || role === "both" || !role;

/** Does this party do job work? (Used to filter the challan pickers.) */
export const isProcessor = (role?: string | null) =>
  role === "processor" || role === "both";
