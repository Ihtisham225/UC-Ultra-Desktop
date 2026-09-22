/**
 * The Roznamcha (daybook) — a rough register of the day. It started with the
 * shawl shops (where it is always on) and is a Settings switch for the rest.
 *
 * ⚠️ Nothing here posts to a balance. A daybook line is what the clerk scribbles
 * as it happens; the real record is raised afterwards and the line is ticked
 * off. See the DaybookEntry model for why double-posting would be a bug.
 */

/** Goods or money coming in, or going out. */
export type DaybookDirectionValue = "in" | "out";

/** A line is about money or about material — never both. */
export type DaybookKindValue = "money" | "material";

export const DAYBOOK_DIRECTIONS: {
  value: DaybookDirectionValue;
  /** Column heading and filter label. */
  label: string;
  /** How the line reads once written: "Khan gave …" / "Ali took …". */
  verb: string;
}[] = [
  { value: "in", label: "In", verb: "gave" },
  { value: "out", label: "Out", verb: "took" },
];

export const DAYBOOK_KINDS: { value: DaybookKindValue; label: string }[] = [
  { value: "money", label: "Amount" },
  { value: "material", label: "Material" },
];

/** Units a material line is usually written in. Free text, so not a closed set. */
export const DAYBOOK_UNITS = ["kg", "lb", "pieces", "bags", "than", "metres"];

/**
 * The records a daybook line can become.
 *
 * `href` is the page that raises it; the daybook hands over by navigating to
 * `${href}?daybook=<entry id>&as=<value>`, and that page opens its own form
 * pre-filled from the line. `kinds` and `directions` decide which targets are
 * offered for a given line — money going out can only become a payment, goods
 * coming in can only become a purchase or a bill for work done.
 */
export const DAYBOOK_LINK_TARGETS = [
  // ── Every store type except handicraft (Settings → Roznamcha) ───────────
  {
    value: "ledger_payment_in",
    label: "Payment received on the ledger",
    hint: "They paid towards what they owe",
    href: "/debts",
    kinds: ["money"],
    directions: ["in"],
    craft: false,
  },
  {
    value: "ledger_payment_out",
    label: "Payment made on the ledger",
    hint: "The shop paid towards what it owes them",
    href: "/debts",
    kinds: ["money"],
    directions: ["out"],
    craft: false,
  },
  {
    value: "ledger_entry",
    label: "New ledger entry",
    hint: "Put the amount on their khata",
    href: "/debts",
    kinds: ["money", "material"],
    directions: ["in", "out"],
    craft: false,
  },
  {
    value: "expense",
    label: "Expense",
    hint: "Money spent on running the shop",
    href: "/expenses",
    kinds: ["money"],
    directions: ["out"],
    // Every store type: a handicraft shop pays for tea and rent too.
    craft: null,
  },
  {
    value: "purchase",
    label: "Purchase",
    hint: "Stock bought in",
    href: "/purchases",
    kinds: ["material", "money"],
    directions: ["in", "out"],
    craft: false,
  },
  // ── Handicraft ───────────────────────────────────────────────────────────
  {
    value: "material_purchase",
    label: "Purchase bill",
    hint: "Yarn or other material bought in",
    href: "/material-purchases",
    kinds: ["material"],
    directions: ["in"],
    craft: true,
  },
  {
    value: "making_receipt",
    label: "Making bill",
    hint: "Shawls the karigar brought back",
    href: "/making",
    kinds: ["material"],
    directions: ["in"],
    craft: true,
  },
  {
    value: "job_work_receipt",
    label: "Job work bill",
    hint: "Goods back from the factory",
    href: "/job-work",
    kinds: ["material"],
    directions: ["in"],
    craft: true,
  },
  {
    value: "making_challan",
    label: "Making challan",
    hint: "Material sent out to a karigar",
    href: "/making",
    kinds: ["material"],
    directions: ["out"],
    craft: true,
  },
  {
    value: "job_work_challan",
    label: "Job work challan",
    hint: "Goods sent for bumbul, rangai, dhulai or press",
    href: "/job-work",
    kinds: ["material"],
    directions: ["out"],
    craft: true,
  },
  {
    value: "customer_challan",
    label: "Customer challan",
    hint: "Finished shawls billed to a customer",
    href: "/customers",
    kinds: ["material"],
    directions: ["out"],
    craft: true,
  },
  {
    value: "customer_payment",
    label: "Customer payment",
    hint: "Money a customer paid in",
    href: "/customers",
    kinds: ["money"],
    directions: ["in"],
    craft: true,
  },
  {
    value: "party_payment_material",
    label: "Payment to a supplier",
    hint: "Settles their material khata",
    href: "/material-purchases",
    kinds: ["money"],
    directions: ["out"],
    craft: true,
  },
  {
    value: "party_payment_making",
    label: "Payment to a maker",
    hint: "Settles a karigar's khata",
    href: "/making",
    kinds: ["money"],
    directions: ["out"],
    craft: true,
  },
  {
    value: "party_payment_processing",
    label: "Payment to a processing company",
    hint: "Settles a factory's khata",
    href: "/job-work",
    kinds: ["money"],
    directions: ["out"],
    craft: true,
  },
] as const satisfies readonly {
  value: string;
  label: string;
  hint: string;
  href: string;
  kinds: readonly DaybookKindValue[];
  directions: readonly DaybookDirectionValue[];
  /** Handicraft shops raise their own records; every other shop the general
   *  ones; null is offered to both. */
  craft: boolean | null;
}[];

export type DaybookLinkTarget = (typeof DAYBOOK_LINK_TARGETS)[number]["value"];

export const DAYBOOK_LINK_VALUES = DAYBOOK_LINK_TARGETS.map((t) => t.value) as DaybookLinkTarget[];

export function daybookTarget(value?: string | null) {
  return DAYBOOK_LINK_TARGETS.find((t) => t.value === value) ?? null;
}

/** The records that make sense for a line — a money line is never a challan. */
export function targetsFor(kind: DaybookKindValue, direction: DaybookDirectionValue, craft = true) {
  return DAYBOOK_LINK_TARGETS.filter(
    (t) =>
      (t.craft === null || t.craft === craft) &&
      (t.kinds as readonly string[]).includes(kind) &&
      (t.directions as readonly string[]).includes(direction),
  );
}

/** Where the pre-filled form lives, for a line handed over to be raised. */
export function handoffHref(target: DaybookLinkTarget, entryId: string): string {
  const t = daybookTarget(target);
  return `${t?.href ?? "/daybook"}?daybook=${entryId}&as=${target}`;
}

/** "4 kg — 2/72 shawl", or an empty string when a line carries neither. */
export function materialLabel(
  quantity: number,
  unit?: string | null,
  description?: string | null,
): string {
  const qty = quantity > 0 ? `${Number(quantity.toFixed(3))}${unit ? ` ${unit}` : ""}` : "";
  const desc = description?.trim() ?? "";
  return [qty, desc].filter(Boolean).join(" — ");
}
