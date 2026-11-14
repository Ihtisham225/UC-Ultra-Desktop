/**
 * Units for recipes. A product's `unit` is free text the shop typed ("Ltr",
 * "kg", "pcs", "Packet"), and a recipe line names its own unit — milk is held
 * in litres but a cup of chai takes 200 ml. This is the one place the two are
 * reconciled.
 *
 * ⚠️ Pure and COPIED verbatim to the desktop (src/lib/units.ts there, pinned by
 * src/test/units.test.ts). The till converts at sale time offline and the
 * server converts on production; the two must agree.
 */

type Dimension = "mass" | "volume" | "count";

interface UnitDef {
  dim: Dimension;
  /** How many of the dimension's smallest unit (g, ml, pcs) one of these is. */
  factor: number;
  label: string;
}

const UNITS: Record<string, UnitDef> = {
  mg: { dim: "mass", factor: 0.001, label: "mg" },
  g: { dim: "mass", factor: 1, label: "g" },
  kg: { dim: "mass", factor: 1000, label: "kg" },
  ml: { dim: "volume", factor: 1, label: "ml" },
  l: { dim: "volume", factor: 1000, label: "L" },
  pcs: { dim: "count", factor: 1, label: "pcs" },
  dozen: { dim: "count", factor: 12, label: "dozen" },
};

/** The spellings shops actually type, folded onto a known unit. */
const ALIASES: Record<string, string> = {
  milligram: "mg", milligrams: "mg",
  gm: "g", gms: "g", gram: "g", grams: "g", gr: "g", grm: "g",
  kgs: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
  millilitre: "ml", milliliter: "ml", millilitres: "ml", milliliters: "ml", mls: "ml",
  ltr: "l", ltrs: "l", lit: "l", lt: "l", litre: "l", liter: "l", litres: "l", liters: "l",
  pc: "pcs", piece: "pcs", pieces: "pcs", nos: "pcs", no: "pcs", unit: "pcs", units: "pcs", each: "pcs",
  dz: "dozen", doz: "dozen", dozens: "dozen",
};

/** The known unit a typed label means, or null when it is the shop's own word ("Packet"). */
export function normalizeUnit(raw: string | null | undefined): string | null {
  const k = String(raw ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!k) return null;
  if (UNITS[k]) return k;
  return ALIASES[k] ?? null;
}

/** Whether a unit weighs, measures volume or counts — null for the shop's own word ("Packet"). */
export function unitDimension(raw: string | null | undefined): Dimension | null {
  const k = normalizeUnit(raw);
  return k ? UNITS[k].dim : null;
}

/** How a unit is shown: "L" for litres, otherwise the canonical short name or what was typed. */
export function unitLabel(raw: string | null | undefined): string {
  const k = normalizeUnit(raw);
  return k ? UNITS[k].label : String(raw ?? "").trim();
}

const sameWord = (a: string | null | undefined, b: string | null | undefined) =>
  String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

/**
 * `qty` of `from` expressed in `to`, or null when they can't be compared — a
 * kilo is not a litre, and a "Packet" is only ever a packet. Two units the app
 * doesn't know convert only when they are the same word.
 */
export function convertQty(qty: number, from: string | null | undefined, to: string | null | undefined): number | null {
  const f = normalizeUnit(from);
  const t = normalizeUnit(to);
  if (f && t) {
    if (UNITS[f].dim !== UNITS[t].dim) return null;
    return (qty * UNITS[f].factor) / UNITS[t].factor;
  }
  return sameWord(from, to) ? qty : null;
}

/**
 * The units a recipe line may use for an ingredient held in `stockUnit`: every
 * unit of the same kind, or just the stock unit itself when it is the shop's
 * own word. The stock unit comes first, spelt as the product spells it.
 */
export function unitChoices(stockUnit: string | null | undefined): string[] {
  const own = String(stockUnit ?? "").trim() || "pcs";
  const k = normalizeUnit(own);
  if (!k) return [own];
  const dim = UNITS[k].dim;
  const rest = Object.entries(UNITS)
    .filter(([key, d]) => d.dim === dim && key !== k)
    .map(([, d]) => d.label);
  return [own, ...rest];
}
