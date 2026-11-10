import { orderTypeLabel as shopOrderTypeLabel } from "./order-types";

/**
 * How a cafe order is served — dine-in (at a table), takeaway or delivery —
 * and the kitchen slip that goes to the kitchen with it. Which order types a
 * till offers, and what they are called, is lib/order-types (every store).
 *
 * ⚠️ Pure and COPIED verbatim to the desktop (pinned by src/test/cafe-order.test.ts).
 */

export type OrderType = "dine_in" | "takeaway" | "delivery";

export const ORDER_TYPES: { value: OrderType; label: string }[] = [
  { value: "dine_in", label: "Dine-in" },
  { value: "takeaway", label: "Takeaway" },
  { value: "delivery", label: "Delivery" },
];

export const orderTypeOf = (raw: unknown): OrderType | null =>
  raw === "dine_in" || raw === "takeaway" || raw === "delivery" ? raw : null;

export const orderTypeLabel = (raw: unknown): string =>
  ORDER_TYPES.find((t) => t.value === raw)?.label ?? "";

type ShopLabels = Parameters<typeof shopOrderTypeLabel>[0];

/** The shop's table names from Settings — trimmed, no blanks, no repeats, in order. */
export function normalizeTables(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,\n]/) : [];
  const out: string[] = [];
  for (const v of list) {
    const t = String(v ?? "").trim().slice(0, 30);
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out.slice(0, 200);
}

/**
 * "Dine-in · Table 4" for the receipt; empty when the bill has no order type.
 * Named with the shop's own labels when the sale carries its shop (a renamed
 * "Take away" prints as the shop calls it, old bills included).
 */
export function orderLine(sale: { order_type?: unknown; table_label?: unknown; shop?: ShopLabels }): string {
  const type = sale.shop ? shopOrderTypeLabel(sale.shop, sale.order_type) : orderTypeLabel(sale.order_type);
  if (!type) return "";
  const table = sale.order_type === "dine_in" && sale.table_label ? ` · Table ${String(sale.table_label)}` : "";
  return `${type}${table}`;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface KitchenSlipSale {
  receipt_number?: string | null;
  created_at: string;
  order_type?: string | null;
  table_label?: string | null;
  shop?: ShopLabels;
  notes?: string | null;
  items?: { product_name: string; quantity: number | string; unit_label?: string | null; unit_factor?: number | string | null }[];
}

/**
 * The kitchen's copy of an order: what to make and where it's going, large
 * and bold for a thermal printer, with NO prices. `when` is the order time,
 * already formatted in the shop's style by the caller.
 */
export function buildKitchenSlipHtml(sale: KitchenSlipSale, shopName: string, when: string): string {
  const lines = (sale.items ?? []).map((it) => {
    // Stored in base units; show what was rung up (2 bottles, not 8 litres).
    const factor = Number(it.unit_factor) > 0 ? Number(it.unit_factor) : 1;
    const q = Math.round((Number(it.quantity) / factor) * 1000) / 1000;
    const unit = it.unit_label && factor !== 1 ? ` ${esc(it.unit_label)}` : "";
    return `<tr><td class="q">${q}${unit}</td><td>${esc(it.product_name)}</td></tr>`;
  }).join("");
  const where = orderLine(sale);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Kitchen ${esc(sale.receipt_number ?? "")}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  body { font-family: "Courier New", monospace; font-weight: 700; color: #000; margin: 0; font-size: 14px; }
  h1 { font-size: 18px; text-align: center; margin: 0 0 4px; letter-spacing: 2px; }
  .big { font-size: 20px; text-align: center; margin: 4px 0; }
  .meta { display: flex; justify-content: space-between; font-size: 12px; }
  hr { border: 0; border-top: 2px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 0; vertical-align: top; font-size: 15px; }
  td.q { width: 22%; white-space: nowrap; }
  .notes { margin-top: 6px; font-size: 13px; white-space: pre-wrap; }
</style></head><body>
<h1>KITCHEN</h1>
<div class="meta"><span>${esc(shopName)}</span><span>#${esc(sale.receipt_number ?? "")}</span></div>
<div class="meta"><span>${esc(when)}</span></div>
${where ? `<div class="big">${esc(where)}</div>` : ""}
<hr />
<table>${lines}</table>
${sale.notes ? `<hr /><div class="notes">${esc(sale.notes)}</div>` : ""}
<hr />
<script>window.onload = function () { window.print(); };</script>
</body></html>`;
}
