/**
 * The return slip — printed on the till's 80mm roll and sent on WhatsApp, the
 * same two ways a sale receipt goes out. Pure (no React, no server) so the
 * desktop can carry an identical copy: `src/lib/return-receipt.ts` there.
 * Keep the two in step.
 */

export interface ReturnSlip {
  return_number: string | null;
  created_at: string;
  sale_receipt_number: string | null;
  refund_method: string;
  account_name: string | null;
  reason: string | null;
  notes: string | null;
  items_total: number;
  deduction: number;
  total_refund: number;
  /** The customer's khata balance when the return was taken (snapshot). */
  previous_balance?: number | null;
  /** Settings → Receipt → previous balance. */
  show_previous_balance?: boolean;
  customer: { name: string; phone: string | null } | null;
  items: { product_name: string; quantity: number; unit_price: number; line_total: number }[];
  shop: {
    name: string;
    address: string | null;
    phone: string | null;
    currency: string;
    receipt_header: string | null;
    receipt_footer: string | null;
  };
}

type Money = (n: number, currency: string) => string;

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const qtyText = (n: number) => String(Number(n.toFixed(3)));

/**
 * The khata line on the slip: printed only when the shop has "previous
 * balance" on AND the customer owed something — the same rule as the sale
 * receipt (lib/receipt-ledger), so a walk-in or a settled customer prints none.
 */
export function returnSlipBalance(r: Pick<ReturnSlip, "previous_balance" | "show_previous_balance">): number | null {
  if (!r.show_previous_balance) return null;
  const n = Number(r.previous_balance);
  return r.previous_balance == null || !Number.isFinite(n) || n <= 0 ? null : Math.round(n * 100) / 100;
}

/** How the refund went out: the account when one was chosen, else the method. */
export function refundedVia(r: Pick<ReturnSlip, "account_name" | "refund_method">): string {
  if (r.account_name) return r.account_name;
  const m = r.refund_method;
  return m === "other" ? "Store credit / other" : m.charAt(0).toUpperCase() + m.slice(1);
}

/** The slip as WhatsApp text — what the customer gets on their phone. */
export function buildReturnMessage(r: ReturnSlip, money: Money, date: string): string {
  const m = (n: number) => money(n, r.shop.currency);
  const out: string[] = [`*${r.shop.name}*`];
  if (r.customer?.name) out.push(`Assalam-o-Alaikum ${r.customer.name},`);
  out.push("", `*Return ${r.return_number ?? ""}*`.trim());
  if (r.sale_receipt_number) out.push(`Against receipt #${r.sale_receipt_number}`);
  out.push(date, "");
  for (const i of r.items) out.push(`${qtyText(i.quantity)} × ${i.product_name} — ${m(i.line_total)}`);
  out.push("");
  if (r.deduction > 0) out.push(`Items: ${m(r.items_total)}`, `Deduction: -${m(r.deduction)}`);
  out.push(`*Refunded: ${m(r.total_refund)}*`, `Via: ${refundedVia(r)}`);
  const owed = returnSlipBalance(r);
  if (owed !== null) out.push("", `Previous balance: ${m(owed)}`);
  if (r.reason) out.push(`Reason: ${r.reason}`);
  if (r.shop.receipt_footer) out.push("", r.shop.receipt_footer);
  return out.join("\n");
}

/** The slip as a standalone 80mm page, ready for window.print(). */
export function buildReturnPrintHtml(r: ReturnSlip, money: Money, date: string): string {
  const m = (n: number) => esc(money(n, r.shop.currency));
  const row = (label: string, value: string) =>
    `<div class="row"><span>${esc(label)}</span><span class="v">${value}</span></div>`;
  const items = r.items
    .map(
      (i) => `<tr><td class="d">${esc(i.product_name)}</td><td class="q">${esc(qtyText(i.quantity))}</td>` +
        `<td class="a">${m(i.line_total)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8" />
<title>Return ${esc(r.return_number ?? "")}</title>
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
  .rule { border-top: 1px solid #000; margin: 7px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .v { text-align: right; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 2px 0; vertical-align: top; }
  th { font-size: 11px; text-align: left; border-bottom: 1px solid #000; }
  .q, .a { text-align: right; white-space: nowrap; padding-left: 6px; }
  .total { display: flex; justify-content: space-between; font-size: 16px; margin-top: 4px; }
</style></head><body><div class="slip">
  <div class="c t">${esc(r.shop.name)}</div>
  ${r.shop.address ? `<div class="c s">${esc(r.shop.address)}</div>` : ""}
  ${r.shop.phone ? `<div class="c s">${esc(r.shop.phone)}</div>` : ""}
  ${r.shop.receipt_header ? `<div class="c s">${esc(r.shop.receipt_header)}</div>` : ""}
  <div class="rule"></div>
  <div class="c">RETURN RECEIPT</div>
  ${row("Return", esc(r.return_number ?? ""))}
  ${r.sale_receipt_number ? row("Against bill", esc(r.sale_receipt_number)) : ""}
  ${row("Date", esc(date))}
  ${r.customer ? row("Customer", esc(r.customer.name)) : ""}
  ${r.customer?.phone ? row("Phone", esc(r.customer.phone)) : ""}
  <div class="rule"></div>
  <table><thead><tr><th>Description</th><th class="q">Qty</th><th class="a">Amt</th></tr></thead><tbody>${items}</tbody></table>
  <div class="rule"></div>
  ${r.deduction > 0 ? row("Items", m(r.items_total)) + row("Deduction", `-${m(r.deduction)}`) : ""}
  <div class="total"><span>REFUNDED</span><span>${m(r.total_refund)}</span></div>
  ${row("Via", esc(refundedVia(r)))}
  ${returnSlipBalance(r) !== null ? `<div class="rule"></div>${row("Previous balance", m(returnSlipBalance(r) as number))}` : ""}
  ${r.reason ? `<div class="s">Reason: ${esc(r.reason)}</div>` : ""}
  ${r.notes ? `<div class="s">Note: ${esc(r.notes)}</div>` : ""}
  ${r.shop.receipt_footer ? `<div class="rule"></div><div class="c s">${esc(r.shop.receipt_footer)}</div>` : ""}
</div><script>window.onload = function () { window.print(); };</script></body></html>`;
}
