/**
 * Purchase orders (to a supplier) and delivery orders (with the truck) — the
 * two slips that list goods without moving any. Printed on the till's 80mm
 * roll or sent on WhatsApp, each WITH or WITHOUT prices: a supplier may be
 * told the agreed rate, a driver's pass usually shouldn't show what the
 * customer paid.
 *
 * Pure (no React, no server). ⚠️ COPIED VERBATIM into the desktop
 * (`src/lib/order-slip.ts`). Keep the two in step.
 */

import { formatAmount } from "@/lib/format";

export interface OrderSlipLine {
  name: string;
  /** As ordered / billed — already converted to the billed unit. */
  quantity: number;
  unit: string | null;
  /** Price of one unit, in the same unit as `quantity`. */
  price: number;
  total: number;
}

export interface OrderSlipDto {
  kind: "purchase" | "delivery";
  number: string;
  /** ISO instant the slip was made. */
  created_at: string;
  /** Supplier (purchase order) or customer (delivery order). */
  party_name: string | null;
  party_phone: string | null;
  lines: OrderSlipLine[];
  total: number;
  notes: string | null;
  /** Purchase order: when the goods are wanted (yyyy-mm-dd). */
  expected_date?: string | null;
  /** Delivery order: the bill it carries, and who is carrying it. */
  bill_number?: string | null;
  vehicle_number?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  deliver_to?: string | null;
}

export interface OrderSlipShop {
  name: string;
  address: string | null;
  phone: string | null;
  currency: string;
  receipt_header: string | null;
  receipt_footer: string | null;
}

type Money = (n: number, currency: string) => string;

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** "12" / "2.5" — no trailing zeros, at most 3 decimals. */
export const slipQty = (n: number) => String(Math.round(n * 1000) / 1000);

export function orderSlipTitle(kind: OrderSlipDto["kind"]) {
  return kind === "purchase"
    ? { title: "PURCHASE ORDER", party: "Supplier" }
    : { title: "DELIVERY ORDER", party: "Customer" };
}

/** The slip as WhatsApp text. */
export function buildOrderSlipMessage(
  s: OrderSlipDto,
  shop: OrderSlipShop,
  money: Money,
  date: string,
  withPrices: boolean,
): string {
  const m = (n: number) => money(n, shop.currency);
  const w = orderSlipTitle(s.kind);
  const out: string[] = [`*${shop.name}*`];
  if (s.kind === "purchase" && s.party_name) out.push(`Assalam-o-Alaikum ${s.party_name},`, "Please send the following:");
  out.push("", `*${w.title} ${s.number}*`, date);
  if (s.kind === "delivery") {
    if (s.bill_number) out.push(`Bill: ${s.bill_number}`);
    if (s.party_name) out.push(`Customer: ${s.party_name}${s.party_phone ? ` (${s.party_phone})` : ""}`);
    if (s.deliver_to) out.push(`Deliver to: ${s.deliver_to}`);
    if (s.vehicle_number) out.push(`Vehicle: ${s.vehicle_number}`);
    if (s.driver_name || s.driver_phone) out.push(`Driver: ${[s.driver_name, s.driver_phone].filter(Boolean).join(" · ")}`);
  }
  if (s.kind === "purchase" && s.expected_date) out.push(`Needed by: ${s.expected_date}`);
  out.push("");
  s.lines.forEach((l, i) => {
    const q = `${slipQty(l.quantity)}${l.unit ? ` ${l.unit}` : ""}`;
    out.push(withPrices ? `${i + 1}. ${l.name} — ${q} × ${m(l.price)} = ${m(l.total)}` : `${i + 1}. ${l.name} — ${q}`);
  });
  const units = s.lines.reduce((a, l) => a + l.quantity, 0);
  out.push("", `Items: ${s.lines.length} · Qty: ${slipQty(units)}`);
  if (withPrices) out.push(`*Total: ${m(s.total)}*`);
  if (s.notes) out.push("", `Note: ${s.notes}`);
  if (shop.receipt_footer && s.kind === "delivery") out.push("", shop.receipt_footer);
  return out.join("\n");
}

/** The slip as a standalone 80mm page, ready for window.print(). */
export function buildOrderSlipHtml(
  s: OrderSlipDto,
  shop: OrderSlipShop,
  money: Money,
  date: string,
  withPrices: boolean,
): string {
  // Inside the table the currency is named once, in the total — repeating it
  // per cell forces the numbers to wrap on a 72mm roll (as on the sale receipt).
  const m = (n: number) => esc(formatAmount(n, shop.currency));
  const w = orderSlipTitle(s.kind);
  const row = (label: string, value: string) =>
    `<div class="row"><span>${esc(label)}</span><span class="v">${value}</span></div>`;
  const units = s.lines.reduce((a, l) => a + l.quantity, 0);
  // With prices each item takes two lines — the name, then "qty × rate … amount" —
  // the way the sale receipt does: four columns on a 72mm roll run together.
  const items = withPrices
    ? `<div>${s.lines
        .map(
          (l) => `<div class="it"><div class="l">${esc(l.name)}</div>` +
            `<div class="row s"><span>${esc(slipQty(l.quantity))}${l.unit ? ` ${esc(l.unit)}` : ""} × ${m(l.price)}</span><span class="v">${m(l.total)}</span></div></div>`,
        )
        .join("")}</div>`
    : `<table><thead><tr><th class="l">Item</th><th>Qty</th><th>Unit</th></tr></thead><tbody>${s.lines
        .map((l) => `<tr><td class="l">${esc(l.name)}</td><td>${esc(slipQty(l.quantity))}</td><td>${esc(l.unit ?? "")}</td></tr>`)
        .join("")}</tbody></table>`;
  const transport =
    s.kind === "delivery"
      ? [
          s.deliver_to ? row("Deliver to", esc(s.deliver_to)) : "",
          s.vehicle_number ? row("Vehicle no.", esc(s.vehicle_number)) : "",
          s.driver_name ? row("Driver", esc(s.driver_name)) : "",
          s.driver_phone ? row("Driver phone", esc(s.driver_phone)) : "",
        ].join("")
      : "";
  const sign =
    s.kind === "delivery"
      ? `<div class="sig"><div><span></span>Driver</div><div><span></span>Received by</div></div>`
      : `<div class="sig"><div><span></span>Authorised by</div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8" />
<title>${esc(w.title)} ${esc(s.number)}</title>
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000;
    font-family: Arial, Helvetica, "Segoe UI", sans-serif; font-weight: 700; font-variant-numeric: tabular-nums; }
  body { width: 100%; max-width: 72mm; margin: 0 auto; }
  .slip { padding: 4mm 3mm 6mm; font-size: 13px; line-height: 1.45; }
  .c { text-align: center; }
  .t { font-size: 18px; text-transform: uppercase; letter-spacing: .04em; }
  .s { font-size: 12px; }
  .doc { font-size: 15px; letter-spacing: .06em; border: 1.5px solid #000; padding: 2px 0; margin: 2px 0 4px; }
  .rule { border-top: 1px solid #000; margin: 7px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .v { text-align: right; overflow-wrap: anywhere; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { padding: 2px 1px; text-align: right; vertical-align: top; }
  th { border-bottom: 1px solid #000; }
  .l { text-align: left; overflow-wrap: anywhere; }
  .it { padding: 2px 0; border-bottom: 1px dotted #000; }
  .it:last-child { border-bottom: 0; }
  .big { font-size: 16px; }
  .sig { display: flex; gap: 10px; margin-top: 26px; font-size: 11px; text-align: center; }
  .sig div { flex: 1; }
  .sig span { display: block; border-top: 1px solid #000; margin-bottom: 2px; }
</style></head><body><div class="slip">
  <div class="c t">${esc(shop.name)}</div>
  ${shop.address ? `<div class="c s">${esc(shop.address)}</div>` : ""}
  ${shop.phone ? `<div class="c s">${esc(shop.phone)}</div>` : ""}
  ${s.kind === "delivery" && shop.receipt_header ? `<div class="c s">${esc(shop.receipt_header)}</div>` : ""}
  <div class="rule"></div>
  <div class="c doc">${esc(w.title)}</div>
  ${row("No.", esc(s.number))}
  ${row("Date", esc(date))}
  ${s.bill_number ? row("Bill no.", esc(s.bill_number)) : ""}
  ${s.party_name ? row(w.party, esc(s.party_name)) : ""}
  ${s.party_phone ? row("Phone", esc(s.party_phone)) : ""}
  ${s.kind === "purchase" && s.expected_date ? row("Needed by", esc(s.expected_date)) : ""}
  ${transport}
  <div class="rule"></div>
  ${items}
  <div class="rule"></div>
  ${row("Items", `${s.lines.length} · Qty ${esc(slipQty(units))}`)}
  ${withPrices ? `<div class="row big"><span>Total (${esc(shop.currency)})</span><span class="v">${m(s.total)}</span></div>` : ""}
  ${s.notes ? `<div class="s" style="margin-top:6px">Note: ${esc(s.notes)}</div>` : ""}
  ${sign}
  ${s.kind === "delivery" && shop.receipt_footer ? `<div class="c s" style="margin-top:8px">${esc(shop.receipt_footer)}</div>` : ""}
</div><script>window.onload = function () { window.print(); };</script></body></html>`;
}
