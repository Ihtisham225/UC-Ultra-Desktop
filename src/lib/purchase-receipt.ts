/**
 * The purchase voucher — what the shop prints (or sends the supplier on
 * WhatsApp) when goods come in. Pure (no React, no server) and COPIED VERBATIM
 * into the desktop (`src/lib/purchase-receipt.ts` there). Keep the two in step.
 *
 * What it prints follows Settings → Receipt → Purchase receipt
 * (lib/receipt-slips PurchaseSlipOptions).
 */
import { normalizePurchaseSlipOptions, type PurchaseSlipOptions } from "@/lib/receipt-slips";

export interface PurchaseSlip {
  reference_number: string | null;
  created_at: string;
  /** The supplier, or a walk-in seller's typed name. */
  supplier: { name: string; phone: string | null } | null;
  items: { product_name: string; quantity: number; unit_cost: number; line_total: number; expense_amount?: number }[];
  subtotal: number;
  tax: number;
  expenses_total: number;
  total: number;
  paid: number;
  /** The money account the payment left, when one was chosen. */
  account_name: string | null;
  notes: string | null;
  /**
   * What the shop owed this supplier just BEFORE this bill — positive = the
   * shop owes them, negative = they owe the shop. Worked out on the server as
   * of the bill's own moment, so a reprint says what was true then. Null when
   * there is no supplier on the register (walk-in seller) or the server is too
   * old to send it.
   */
  previous_balance: number | null;
  /** Settings → Receipt → Purchase receipt. Missing = the defaults. */
  options?: PurchaseSlipOptions;
  shop: {
    name: string;
    address: string | null;
    phone: string | null;
    currency: string;
    receipt_header: string | null;
    receipt_footer: string | null;
    logo_url?: string | null;
  };
}

type Money = (n: number, currency: string) => string;

const r2 = (n: number) => Math.round(n * 100) / 100;
const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const qtyText = (n: number) => String(Number(Number(n).toFixed(3)));

export const purchaseSlipOptions = (p: Pick<PurchaseSlip, "options">): PurchaseSlipOptions =>
  p.options ?? normalizePurchaseSlipOptions(null);

export const purchaseSlipLogo = (p: PurchaseSlip): string | null =>
  purchaseSlipOptions(p).show_logo && p.shop.logo_url ? p.shop.logo_url : null;

/** What is still unpaid on this bill. */
export const purchaseUnpaid = (p: Pick<PurchaseSlip, "total" | "paid">) => Math.max(0, r2(Number(p.total) - Number(p.paid)));

/** A balance as the slip words it: owed TO the supplier, or held WITH them. */
export function payableLine(n: number, total = false): { label: string; amount: number } {
  if (n >= 0) return { label: total ? "TOTAL PAYABLE" : "Previous balance", amount: r2(n) };
  return { label: total ? "SUPPLIER OWES YOU" : "Previous (they owe you)", amount: r2(-n) };
}

/**
 * The supplier's khata block — previous balance, this bill's unpaid part, and
 * where the account stands after it. Null when the shop turned it off, or there
 * is no supplier on the register to have a balance.
 */
export function purchaseSlipLedger(
  p: Pick<PurchaseSlip, "previous_balance" | "total" | "paid" | "options" | "supplier">,
): { previous: number; bill: number; after: number } | null {
  if (!purchaseSlipOptions(p).show_previous_balance || !p.supplier || p.previous_balance == null) return null;
  const previous = r2(Number(p.previous_balance));
  if (!Number.isFinite(previous)) return null;
  const bill = purchaseUnpaid(p);
  return { previous, bill, after: r2(previous + bill) };
}

/** The voucher as WhatsApp text — what the supplier gets on their phone. */
export function buildPurchaseMessage(p: PurchaseSlip, money: Money, date: string): string {
  const m = (n: number) => money(n, p.shop.currency);
  const o = purchaseSlipOptions(p);
  const out: string[] = [`*${p.shop.name}*`];
  if (p.supplier?.name) out.push(`Assalam-o-Alaikum ${p.supplier.name},`);
  out.push("", `*Purchase ${p.reference_number ?? ""}*`.trim(), date, "");
  for (const i of p.items) {
    out.push(o.show_unit_cost
      ? `${qtyText(i.quantity)} × ${i.product_name} @ ${m(i.unit_cost)} — ${m(i.line_total)}`
      : `${qtyText(i.quantity)} × ${i.product_name} — ${m(i.line_total)}`);
  }
  out.push("");
  if (o.show_expenses && p.expenses_total > 0) out.push(`Expenses: ${m(p.expenses_total)}`);
  if (p.tax > 0) out.push(`Tax: ${m(p.tax)}`);
  out.push(`*Total: ${m(p.total)}*`, `Paid: ${m(p.paid)}`);
  const led = purchaseSlipLedger(p);
  if (led) {
    const prev = payableLine(led.previous);
    const after = payableLine(led.after, true);
    out.push("", `${prev.label}: ${m(prev.amount)}`, `This bill (unpaid): ${m(led.bill)}`, `*${after.label}: ${m(after.amount)}*`);
  } else if (purchaseUnpaid(p) > 0) out.push(`Balance due: ${m(purchaseUnpaid(p))}`);
  if (o.show_notes && p.notes) out.push("", `Note: ${p.notes}`);
  return out.join("\n");
}

/** The voucher as a standalone 80mm page, ready for window.print(). */
export function buildPurchasePrintHtml(p: PurchaseSlip, money: Money, date: string): string {
  const o = purchaseSlipOptions(p);
  const m = (n: number) => esc(money(n, p.shop.currency));
  const row = (label: string, value: string, cls = "") =>
    `<div class="row ${cls}"><span>${esc(label)}</span><span class="v">${value}</span></div>`;
  const items = p.items
    .map((i) =>
      `<tr><td class="d">${esc(i.product_name)}</td><td class="q">${esc(qtyText(i.quantity))}</td>` +
      (o.show_unit_cost ? `<td class="a">${m(i.unit_cost)}</td>` : "") +
      `<td class="a">${m(i.line_total)}</td></tr>`)
    .join("");
  const led = purchaseSlipLedger(p);
  const unpaid = purchaseUnpaid(p);
  const logo = purchaseSlipLogo(p);
  return `<!doctype html><html><head><meta charset="utf-8" />
<title>Purchase ${esc(p.reference_number ?? "")}</title>
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000;
    font-family: Arial, Helvetica, "Segoe UI", sans-serif; font-weight: 700; font-variant-numeric: tabular-nums; }
  body { width: 100%; max-width: 72mm; margin: 0 auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .slip { padding: 4mm 3mm 6mm; font-size: 13px; line-height: 1.45; }
  .c { text-align: center; }
  .t { font-size: 18px; text-transform: uppercase; letter-spacing: .04em; }
  .s { font-size: 12px; }
  .rule { border-top: 1px solid #000; margin: 7px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .v { text-align: right; word-break: break-word; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 2px 0; vertical-align: top; }
  th { font-size: 11px; text-align: left; border-bottom: 1px solid #000; }
  td.d { word-break: break-word; }
  .q, .a { text-align: right; white-space: nowrap; padding-left: 6px; }
  .big { font-size: 16px; }
  .logo { display: block; margin: 0 auto 6px; max-width: 48mm; max-height: 22mm; object-fit: contain; }
</style></head><body><div class="slip">
  ${logo ? `<img class="logo" src="${esc(logo)}" alt="" />` : ""}
  <div class="c t">${esc(p.shop.name)}</div>
  ${p.shop.address ? `<div class="c s">${esc(p.shop.address)}</div>` : ""}
  ${p.shop.phone ? `<div class="c s">${esc(p.shop.phone)}</div>` : ""}
  <div class="rule"></div>
  <div class="c">PURCHASE VOUCHER</div>
  ${row("Voucher", esc(p.reference_number ?? ""))}
  ${row("Date", esc(date))}
  ${o.show_supplier && p.supplier ? row("Supplier", esc(p.supplier.name)) : ""}
  ${o.show_supplier && p.supplier?.phone ? row("Phone", esc(p.supplier.phone)) : ""}
  <div class="rule"></div>
  <table><thead><tr><th>Description</th><th class="q">Qty</th>${o.show_unit_cost ? `<th class="a">@</th>` : ""}<th class="a">Amt</th></tr></thead><tbody>${items}</tbody></table>
  <div class="rule"></div>
  ${row("Subtotal", m(p.subtotal))}
  ${o.show_expenses && p.expenses_total > 0 ? row("Expenses", m(p.expenses_total)) : ""}
  ${p.tax > 0 ? row("Tax", m(p.tax)) : ""}
  ${row("TOTAL", m(p.total), "big")}
  ${row(`Paid${p.account_name ? ` (${p.account_name})` : ""}`, m(p.paid), "s")}
  ${led
    ? `<div class="rule"></div>${row(payableLine(led.previous).label, m(payableLine(led.previous).amount))}` +
      `${row("This bill (unpaid)", m(led.bill))}<div class="rule"></div>` +
      `${row(payableLine(led.after, true).label, m(payableLine(led.after, true).amount), "big")}`
    : unpaid > 0 ? row("Balance due", m(unpaid), "s") : ""}
  ${o.show_notes && p.notes ? `<div class="rule"></div><div class="s">Note: ${esc(p.notes)}</div>` : ""}
  ${o.show_signature ? `<div class="s" style="margin-top:18px">Received by ________________</div>` : ""}
  ${p.shop.receipt_footer ? `<div class="rule"></div><div class="c s">${esc(p.shop.receipt_footer)}</div>` : ""}
  <div class="c s" style="margin-top:8px">** Goods received **</div>
</div><script>window.onload = function () { window.print(); };</script></body></html>`;
}
