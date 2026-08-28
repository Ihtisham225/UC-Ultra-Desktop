/**
 * Handicraft shops (shawl makers) use the app as a register, not as a till.
 * They buy yarn from several parties, send it out to a karigar who makes the
 * shawls, send those on to a factory for bumbul / rangai / dhulai / press, and
 * take them back on a second bill — but they never sell through the app, hold
 * no stock in it, and keep no product catalogue.
 *
 * Everything selling- or stock-shaped is therefore hidden for them. Ask this
 * rather than comparing `store_type` by hand, so the rule lives in one place.
 */
export function isHandicraft(
  shop?: { store_type?: string | null } | null,
): boolean {
  return shop?.store_type === "handicraft";
}

/**
 * What a party does for the shop. A party can do more than one of these — a
 * karigar who also presses, a yarn dealer who also dyes — so they're flags,
 * not one value.
 */
export interface PartyRoles {
  is_supplier?: boolean | null;
  is_maker?: boolean | null;
  is_processor?: boolean | null;
}

export const PARTY_ROLE_FIELDS = [
  {
    key: "is_supplier" as const,
    label: "Supplier",
    hint: "Sells you yarn and other material",
  },
  {
    key: "is_maker" as const,
    label: "Maker (karigar)",
    hint: "Takes material and makes the shawls",
  },
  {
    key: "is_processor" as const,
    label: "Processing company",
    hint: "Bumbul, rangai, dhulai, press",
  },
];

/** Sells material — the only parties a purchase can be booked against. */
export const isMaterialSupplier = (p?: PartyRoles | null) => !!p?.is_supplier;

/** Makes the shawls — the parties a making challan can go to. */
export const isMaker = (p?: PartyRoles | null) => !!p?.is_maker;

/** Does the finishing work — the parties a processing challan can go to. */
export const isProcessor = (p?: PartyRoles | null) => !!p?.is_processor;

/** Short label for a party row: "Supplier · Maker". */
export function partyRoleLabel(p?: PartyRoles | null): string {
  const parts = PARTY_ROLE_FIELDS.filter((f) => p?.[f.key]).map((f) =>
    f.key === "is_maker" ? "Maker" : f.key === "is_processor" ? "Processing" : "Supplier",
  );
  return parts.length ? parts.join(" · ") : "No role set";
}

/** The two directions goods travel out of the shop. */
export type ChallanKindValue = "making" | "processing";

export const CHALLAN_KIND = {
  making: {
    /** Nav label and page title. */
    title: "Making",
    /** What the party is called on that page. */
    party: "Maker",
    partyPlural: "Makers",
    /** Heading on the printed challan. */
    urdu: "بنائی کے لیے بھیجا گیا مال",
    english: "GOODS SENT FOR MAKING",
    blurb: "Material sent to the karigars, and the shawls they bring back.",
  },
  processing: {
    title: "Job work",
    party: "Company",
    partyPlural: "Processing companies",
    urdu: "بھیجا گیا مال",
    english: "GOODS SENT FOR PROCESSING",
    blurb: "Goods sent out for bumbul, rangai, dhulai and press — and the bills for the work done.",
  },
} satisfies Record<ChallanKindValue, Record<string, string>>;
