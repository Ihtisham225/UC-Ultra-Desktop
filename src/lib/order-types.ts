/**
 * How a sale was served, and how it was paid — the shop's own POS flow.
 *
 * Every store chooses which order types its till offers (Settings → Shop →
 * "Till order types") and what they are called: Dine-in, Take away, Delivery,
 * Pick-up later, any of its own, and — for an oil shop — the oil change. The
 * chosen key is stored on the bill (`sales.order_type`) and the label is read
 * from the shop at display time, so renaming a type renames it on every old
 * bill too.
 *
 * ⚠️ Pure and COPIED verbatim to the desktop (pinned by its
 * src/test/order-types.test.ts) — change both together.
 */

export interface OrderTypeSetting {
  /** Stored on the bill. Built-ins keep fixed keys; the shop's own get "c_…". */
  key: string;
  label: string;
  enabled: boolean;
  /** One the shop added itself (can be removed, not just switched off). */
  custom?: boolean;
}

/** The oil change isn't a button at the till — it's the vehicle form beside the bill. */
export const OIL_CHANGE_KEY = "oil_change";

const BUILT_IN: { key: string; label: string; hint: string }[] = [
  { key: "dine_in", label: "Dine-in", hint: "Eaten at the shop, with an optional table" },
  { key: "takeaway", label: "Take away", hint: "Packed for the customer to take" },
  { key: "delivery", label: "Delivery", hint: "Sent to the customer" },
  { key: "pickup", label: "Pick-up later", hint: "Ordered now, collected later" },
];

export const ORDER_TYPE_HINTS: Record<string, string> = {
  ...Object.fromEntries(BUILT_IN.map((b) => [b.key, b.hint])),
  [OIL_CHANGE_KEY]: "The vehicle form at the till, and the oil-change register",
};

const MAX_CUSTOM = 10;
const KEY = /^[a-z0-9_]{1,40}$/;

interface ShopLike {
  store_type?: string | null;
  order_types?: unknown;
}

/**
 * What a shop had before this setting existed, so nothing changes on deploy:
 * a cafe offered Dine-in / Takeaway / Delivery at the till, and an oil shop
 * always showed the vehicle form. Every other store offered nothing.
 */
function defaultEnabled(key: string, storeType: string | null | undefined): boolean {
  if (key === OIL_CHANGE_KEY) return storeType === "oil";
  if (storeType === "cafe") return key === "dine_in" || key === "takeaway" || key === "delivery";
  return false;
}

/**
 * The shop's full list, saved or not: every built-in (plus the oil change for
 * an oil shop) in a fixed order, then the shop's own. Labels are trimmed and
 * never blank — a blank one falls back to the built-in name.
 */
export function orderTypeSettings(
  shop: ShopLike | null | undefined,
  /** The Settings form keeps a just-added row while its label is still blank. */
  opts?: { keepBlank?: boolean },
): OrderTypeSetting[] {
  const storeType = shop?.store_type ?? null;
  const saved = Array.isArray(shop?.order_types) ? (shop!.order_types as unknown[]) : null;
  const byKey = new Map<string, { label?: unknown; enabled?: unknown; custom?: unknown }>();
  for (const raw of saved ?? []) {
    const r = (raw ?? {}) as { key?: unknown };
    if (typeof r.key === "string" && KEY.test(r.key) && !byKey.has(r.key)) byKey.set(r.key, r as never);
  }
  const label = (v: unknown, fallback: string) => {
    const s = typeof v === "string" ? v.trim().slice(0, 30) : "";
    return s || fallback;
  };

  const builtIns = [...BUILT_IN, ...(storeType === "oil" ? [{ key: OIL_CHANGE_KEY, label: "Oil change", hint: "" }] : [])];
  const out: OrderTypeSetting[] = builtIns.map((b) => {
    const s = byKey.get(b.key);
    return {
      key: b.key,
      label: label(s?.label, b.label),
      enabled: s && typeof s.enabled === "boolean" ? s.enabled : defaultEnabled(b.key, storeType),
    };
  });
  let customs = 0;
  for (const [key, s] of byKey) {
    if (!key.startsWith("c_") || customs >= MAX_CUSTOM) continue;
    const name = label(s.label, "");
    if (!name && !opts?.keepBlank) continue;
    out.push({ key, label: name, enabled: s.enabled !== false, custom: true });
    customs += 1;
  }
  return out;
}

/** The buttons the till offers, in order. Never the oil change (that's the vehicle form). */
export function tillOrderTypes(shop: ShopLike | null | undefined): OrderTypeSetting[] {
  return orderTypeSettings(shop).filter((t) => t.enabled && t.key !== OIL_CHANGE_KEY);
}

/** Whether an oil shop's till shows the vehicle form. */
export function oilChangeEnabled(shop: ShopLike | null | undefined): boolean {
  return orderTypeSettings(shop).some((t) => t.key === OIL_CHANGE_KEY && t.enabled);
}

export function oilChangeLabel(shop: ShopLike | null | undefined): string {
  return orderTypeSettings(shop).find((t) => t.key === OIL_CHANGE_KEY)?.label ?? "Oil change";
}

/**
 * The name a bill's order type shows under — the shop's CURRENT label, so a
 * rename reaches old bills. A switched-off or since-removed type still reads
 * as something sensible rather than vanishing from history.
 */
export function orderTypeLabel(shop: ShopLike | null | undefined, key: unknown): string {
  if (typeof key !== "string" || !key) return "";
  const found = orderTypeSettings(shop).find((t) => t.key === key);
  if (found) return found.label;
  const builtIn = BUILT_IN.find((b) => b.key === key);
  if (builtIn) return builtIn.label;
  if (key === "takeaway") return "Take away";
  return key.startsWith("c_") ? "Other" : key.replace(/_/g, " ");
}

/** Which button the till starts on: Dine-in when the shop offers it (a cafe), else none. */
export function defaultTillOrderType(shop: ShopLike | null | undefined): string | null {
  return tillOrderTypes(shop).some((t) => t.key === "dine_in") ? "dine_in" : null;
}

/** A key the till may store: a built-in or one of the "c_…" form. */
export const isOrderTypeKey = (v: unknown): v is string => typeof v === "string" && KEY.test(v);

/** A fresh key for a type the shop adds itself. */
export function newCustomKey(existing: OrderTypeSetting[]): string {
  for (let i = 1; ; i++) {
    const key = `c_${i}`;
    if (!existing.some((t) => t.key === key)) return key;
  }
}

/** What Settings saves: just the keys, labels and switches. */
export function serializeOrderTypes(list: OrderTypeSetting[]): { key: string; label: string; enabled: boolean }[] {
  return list
    .filter((t) => KEY.test(t.key) && (t.label.trim() || !t.custom))
    .map((t) => ({ key: t.key, label: t.label.trim().slice(0, 30), enabled: !!t.enabled }));
}

// ─── How it was paid ────────────────────────────────────────────────────────

export type PaymentStatus = "paid" | "ledger" | "part";

/**
 * Paid in full, put entirely on the customer's ledger, or a bit of both.
 * `paid` is what was handed over (a cash checkout stores the change too, so
 * anything at or above the total is paid).
 */
export function paymentStatus(total: number | string, paid: number | string): PaymentStatus {
  const t = Number(total) || 0;
  const p = Number(paid) || 0;
  if (t <= 0 || p >= t - 0.005) return "paid";
  if (p <= 0.005) return "ledger";
  return "part";
}

/** The sales-page filters, in the order shown. */
export type SaleFilter =
  | { kind: "all" }
  | { kind: "order_type"; key: string }
  | { kind: "oil_change" }
  | { kind: "payment"; status: PaymentStatus };

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  paid: "Paid",
  ledger: "On ledger",
  part: "Part ledger",
};

/** Encode a filter as one string (a Select value / URL param). */
export const filterValue = (f: SaleFilter): string =>
  f.kind === "all" ? "all"
    : f.kind === "order_type" ? `type:${f.key}`
    : f.kind === "oil_change" ? OIL_CHANGE_KEY
    : `pay:${f.status}`;

export function parseFilter(v: unknown): SaleFilter {
  const s = typeof v === "string" ? v : "";
  if (s === OIL_CHANGE_KEY) return { kind: "oil_change" };
  if (s.startsWith("type:") && isOrderTypeKey(s.slice(5))) return { kind: "order_type", key: s.slice(5) };
  if (s === "pay:paid" || s === "pay:ledger" || s === "pay:part") return { kind: "payment", status: s.slice(4) as PaymentStatus };
  return { kind: "all" };
}

/** The filters the sales page offers this shop, with their labels. */
export function saleFilterOptions(shop: ShopLike | null | undefined): { value: string; label: string }[] {
  const settings = orderTypeSettings(shop);
  return [
    { value: "all", label: "All sales" },
    ...settings
      .filter((t) => t.enabled && t.key !== OIL_CHANGE_KEY)
      .map((t) => ({ value: `type:${t.key}`, label: t.label })),
    ...(settings.some((t) => t.key === OIL_CHANGE_KEY && t.enabled) ? [{ value: OIL_CHANGE_KEY, label: oilChangeLabel(shop) }] : []),
    { value: "pay:ledger", label: PAYMENT_LABELS.ledger },
    { value: "pay:part", label: PAYMENT_LABELS.part },
    { value: "pay:paid", label: PAYMENT_LABELS.paid },
  ];
}

/** Whether one bill matches a filter — the desktop filters its offline list with this. */
export function saleMatchesFilter(
  sale: { order_type?: string | null; total: number | string; amount_paid?: number | string | null; has_oil_change?: boolean },
  f: SaleFilter,
): boolean {
  switch (f.kind) {
    case "all": return true;
    case "order_type": return sale.order_type === f.key;
    case "oil_change": return !!sale.has_oil_change;
    case "payment": return paymentStatus(sale.total, sale.amount_paid ?? 0) === f.status;
  }
}
