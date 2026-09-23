/**
 * The receipt for a payment against the khata — "you paid 10,000; you owed
 * 50,000; 40,000 remains" — printed on the till's 80mm roll or sent on
 * WhatsApp. Pure (no React, no server) and COPIED VERBATIM into the desktop
 * (`src/lib/payment-receipt.ts` there). Keep the two in step.
 */

export interface PaymentReceiptDto {
  id: string;
  /** Null until the server numbers it (a terminal's offline payment). */
  receipt_number: string | null;
  person_name: string;
  phone: string | null;
  /** owed_to_me: received from a customer. i_owe: paid to a supplier. */
  direction: "owed_to_me" | "i_owe";
  amount: number;
  discount: number;
  /** How it was paid: the account's name, or "Cheque 123456". */
  method: string | null;
  balance_before: number;
  /** Below zero: they paid more than was owed and are now in credit. */
  balance_after: number;
  payment_date: string;
  notes: string | null;
  created_at: string;
}

export interface PaymentSlipShop {
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

/** What the slip is called, and who the other side is. */
export function paymentSlipWords(r: Pick<PaymentReceiptDto, "direction">) {
  return r.direction === "i_owe"
    ? { title: "PAYMENT VOUCHER", party: "Paid to" }
    : { title: "PAYMENT RECEIPT", party: "Received from" };
}

/** The number as printed — an offline payment has none until it syncs. */
export const receiptNo = (r: Pick<PaymentReceiptDto, "receipt_number">) => r.receipt_number ?? "Pending sync";

/** "Balance remaining", or — past zero — what is now held in their favour. */
export function balanceAfterLine(after: number): { label: string; amount: number } {
  return after >= 0 ? { label: "Balance remaining", amount: after } : { label: "Advance (in credit)", amount: -after };
}

/** The receipt as WhatsApp text. */
export function buildPaymentReceiptMessage(r: PaymentReceiptDto, shop: PaymentSlipShop, money: Money, date: string): string {
  const m = (n: number) => money(n, shop.currency);
  const w = paymentSlipWords(r);
  const after = balanceAfterLine(r.balance_after);
  const out: string[] = [`*${shop.name}*`];
  if (r.direction === "owed_to_me") out.push(`Assalam-o-Alaikum ${r.person_name},`);
  out.push("", `*${w.title} ${receiptNo(r)}*`, date, "");
  out.push(`Previous balance: ${m(r.balance_before)}`);
  out.push(`*${r.direction === "i_owe" ? "Paid" : "Received"}: ${m(r.amount)}*`);
  if (r.discount > 0) out.push(`Discount: ${m(r.discount)}`);
  if (r.method) out.push(`Via: ${r.method}`);
  out.push(`*${after.label}: ${m(after.amount)}*`);
  if (r.notes) out.push("", `Note: ${r.notes}`);
  if (r.direction === "owed_to_me") out.push("", "Thank you for your payment.");
  if (shop.receipt_footer) out.push("", shop.receipt_footer);
  return out.join("\n");
}

/** The receipt as a standalone 80mm page, ready for window.print(). */
export function buildPaymentReceiptHtml(r: PaymentReceiptDto, shop: PaymentSlipShop, money: Money, date: string): string {
  const m = (n: number) => esc(money(n, shop.currency));
  const w = paymentSlipWords(r);
  const after = balanceAfterLine(r.balance_after);
  const row = (label: string, value: string, cls = "") =>
    `<div class="row ${cls}"><span>${esc(label)}</span><span class="v">${value}</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8" />
<title>${esc(w.title)} ${esc(receiptNo(r))}</title>
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000;
    font-family: Arial, Helvetica, "Segoe UI", sans-serif; font-weight: 700; font-variant-numeric: tabular-nums; }
  body { width: 100%; max-width: 72mm; margin: 0 auto; }
  .slip { padding: 4mm 3mm 6mm; font-size: 13px; line-height: 1.5; }
  .c { text-align: center; }
  .t { font-size: 18px; text-transform: uppercase; letter-spacing: .04em; }
  .s { font-size: 12px; }
  .rule { border-top: 1px solid #000; margin: 7px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .v { text-align: right; }
  .big { font-size: 16px; }
  .box { border: 1.5px solid #000; padding: 4px 6px; margin-top: 4px; }
</style></head><body><div class="slip">
  <div class="c t">${esc(shop.name)}</div>
  ${shop.address ? `<div class="c s">${esc(shop.address)}</div>` : ""}
  ${shop.phone ? `<div class="c s">${esc(shop.phone)}</div>` : ""}
  ${shop.receipt_header ? `<div class="c s">${esc(shop.receipt_header)}</div>` : ""}
  <div class="rule"></div>
  <div class="c">${esc(w.title)}</div>
  ${row("Receipt no.", esc(receiptNo(r)))}
  ${row("Date", esc(date))}
  ${row(w.party, esc(r.person_name))}
  ${r.phone ? row("Phone", esc(r.phone)) : ""}
  <div class="rule"></div>
  ${row("Previous balance", m(r.balance_before))}
  ${row(r.direction === "i_owe" ? "Paid" : "Received", m(r.amount), "big")}
  ${r.discount > 0 ? row("Discount", m(r.discount)) : ""}
  ${r.method ? row("Via", esc(r.method)) : ""}
  <div class="box">${row(after.label, m(after.amount), "big")}</div>
  ${r.notes ? `<div class="s" style="margin-top:6px">Note: ${esc(r.notes)}</div>` : ""}
  <div class="rule"></div>
  ${r.direction === "owed_to_me" ? `<div class="c s">Thank you for your payment.</div>` : ""}
  ${shop.receipt_footer ? `<div class="c s">${esc(shop.receipt_footer)}</div>` : ""}
</div><script>window.onload = function () { window.print(); };</script></body></html>`;
}
