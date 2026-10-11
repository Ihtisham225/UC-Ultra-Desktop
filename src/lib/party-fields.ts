/**
 * The shop's own extra fields on a customer or supplier — "CNIC", "Area",
 * "Vehicle no.", whatever the shop keeps that the app doesn't ask for.
 *
 * The shop defines them once (`shops.party_fields`, Settings → Shop); each
 * party stores its answers by field id (`suppliers.custom_fields`, a plain
 * `{ [fieldId]: text }` map). Ids, not labels, are the keys, so renaming a
 * field keeps every answer already typed; deleting one only hides its answers.
 *
 * A customer field can also go on the sale receipt (`on_receipt`).
 *
 * Pure (no Prisma, no React) — ⚠️ COPIED verbatim to the desktop app.
 */

export type PartyFieldScope = "customer" | "supplier" | "both";

export interface PartyField {
  id: string;
  label: string;
  /** Which form asks for it. */
  applies: PartyFieldScope;
  /** Print on the sale receipt (customer fields only). */
  on_receipt: boolean;
}

export type PartyFieldValues = Record<string, string>;

export const MAX_PARTY_FIELDS = 12;
const MAX_LABEL = 40;
const MAX_VALUE = 200;

const newId = () =>
  `f_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;

/** A blank field for the editor. */
export const blankPartyField = (): PartyField => ({ id: newId(), label: "", applies: "customer", on_receipt: false });

/** Anything stored or sent → a clean list: labelled, de-duplicated, capped. */
export function normalizePartyFields(raw: unknown): PartyField[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: PartyField[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const f = r as Partial<PartyField>;
    const label = typeof f.label === "string" ? f.label.trim().slice(0, MAX_LABEL) : "";
    const id = typeof f.id === "string" && /^[\w-]{1,40}$/.test(f.id) ? f.id : "";
    if (!label || !id || seen.has(id)) continue;
    seen.add(id);
    const applies: PartyFieldScope = f.applies === "supplier" || f.applies === "both" ? f.applies : "customer";
    out.push({ id, label, applies, on_receipt: applies !== "supplier" && f.on_receipt === true });
    if (out.length >= MAX_PARTY_FIELDS) break;
  }
  return out;
}

/** The fields one form asks for. A party that is both sees each field once. */
export function fieldsFor(fields: PartyField[] | null | undefined, roles: { customer?: boolean; supplier?: boolean }): PartyField[] {
  return (fields ?? []).filter(
    (f) => f.applies === "both" || (f.applies === "customer" && roles.customer) || (f.applies === "supplier" && roles.supplier),
  );
}

/** A party's stored answers → a clean `{ id: text }` map (empty answers dropped). */
export function normalizePartyValues(raw: unknown): PartyFieldValues {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: PartyFieldValues = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[\w-]{1,40}$/.test(k)) continue;
    const text = typeof v === "string" ? v.trim().slice(0, MAX_VALUE) : typeof v === "number" ? String(v) : "";
    if (text) out[k] = text;
  }
  return out;
}

/**
 * Merge a form's answers into what is stored. Only the fields the form showed
 * are touched, so a supplier-only answer survives an edit from the customer
 * form — and answers to deleted fields are kept, in case the field comes back.
 */
export function mergePartyValues(stored: unknown, shown: PartyField[], typed: PartyFieldValues): PartyFieldValues {
  const out = normalizePartyValues(stored);
  for (const f of shown) {
    const v = (typed[f.id] ?? "").trim().slice(0, MAX_VALUE);
    if (v) out[f.id] = v;
    else delete out[f.id];
  }
  return out;
}

/** What prints on a sale receipt: the receipt fields that this customer filled in. */
export function receiptFieldRows(fields: PartyField[] | null | undefined, values: unknown): { label: string; value: string }[] {
  const v = normalizePartyValues(values);
  return (fields ?? [])
    .filter((f) => f.on_receipt && f.applies !== "supplier" && v[f.id])
    .map((f) => ({ label: f.label, value: v[f.id] }));
}
