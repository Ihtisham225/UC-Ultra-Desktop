/**
 * A4 ledger statements — one party, or every party in one run.
 *
 * The shop hands these to a customer to settle up, so the document has to
 * stand on its own: who it is for, what they were billed, what they have paid
 * and when, and what is left. Printed through the browser, which is also how
 * it becomes a PDF ("Save as PDF" in the print dialog).
 */

export interface StatementPayment {
  payment_date: string;
  amount: number;
  discount: number;
  kind: string;
  notes: string | null;
}

export interface StatementLedger {
  person_name: string;
  phone: string | null;
  direction: string;
  amount: number;
  paid_amount: number;
  notes: string | null;
  payments: StatementPayment[];
}

export interface StatementShop {
  name: string;
  phone?: string | null;
  address?: string | null;
}

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Grouped, 2dp, no currency symbol — the currency is named once per sheet. */
const amt = (n: number) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function statementBody(ledger: StatementLedger, currency: string): string {
  const remaining = Math.max(ledger.amount - ledger.paid_amount, 0);
  const owedToUs = ledger.direction === "owed_to_me";
  // A statement reads as a running account, so the balance is carried down the
  // page the way a paper khata does rather than only landing at the bottom.
  let running = ledger.amount;
  const rows = [...ledger.payments]
    .sort((a, b) => a.payment_date.localeCompare(b.payment_date))
    .map((p) => {
      const isIncrease = p.kind === "increase";
      const cleared = isIncrease ? 0 : p.amount + p.discount;
      running = isIncrease ? running + p.amount : running - cleared;
      return `
        <tr>
          <td>${esc(p.payment_date)}</td>
          <td>${esc(isIncrease ? "Added to account" : "Payment")}${p.notes ? ` — ${esc(p.notes)}` : ""}</td>
          <td class="num">${isIncrease ? amt(p.amount) : ""}</td>
          <td class="num">${isIncrease ? "" : amt(p.amount)}</td>
          <td class="num">${p.discount > 0 ? amt(p.discount) : ""}</td>
          <td class="num">${amt(running)}</td>
        </tr>`;
    })
    .join("");

  const discountTotal = ledger.payments.reduce((a, p) => a + (p.kind === "increase" ? 0 : p.discount), 0);

  return `
    <section class="statement">
      <div class="party">
        <div>
          <div class="party-name">${esc(ledger.person_name)}</div>
          ${ledger.phone ? `<div class="muted">${esc(ledger.phone)}</div>` : ""}
        </div>
        <div class="tag ${owedToUs ? "receive" : "pay"}">
          ${owedToUs ? "Owes the shop" : "The shop owes"}
        </div>
      </div>

      <table class="entries">
        <thead>
          <tr>
            <th>Date</th><th>Detail</th>
            <th class="num">Charged</th><th class="num">Paid</th>
            <th class="num">Discount</th><th class="num">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr class="opening">
            <td></td><td>Opening — total billed</td>
            <td class="num">${amt(ledger.amount)}</td><td class="num"></td>
            <td class="num"></td><td class="num">${amt(ledger.amount)}</td>
          </tr>
          ${rows || `<tr><td colspan="6" class="muted center">No payments recorded yet.</td></tr>`}
        </tbody>
      </table>

      <div class="totals">
        <div><span>Total billed</span><b>${amt(ledger.amount)}</b></div>
        <div><span>Received</span><b>${amt(ledger.paid_amount - discountTotal)}</b></div>
        ${discountTotal > 0 ? `<div><span>Discount given</span><b>${amt(discountTotal)}</b></div>` : ""}
        <div class="grand"><span>${owedToUs ? "Balance due" : "Balance we owe"}</span><b>${currency} ${amt(remaining)}</b></div>
      </div>

      <div class="sign">
        <div><span></span>Received by</div>
        <div><span></span>Customer signature</div>
      </div>
    </section>`;
}

export function buildLedgerStatementHtml(args: {
  shop: StatementShop;
  ledgers: StatementLedger[];
  currency: string;
  /** Shown under the shop name, e.g. the filter the list was printed from. */
  subtitle?: string;
}): string {
  const { shop, ledgers, currency, subtitle } = args;
  const printedOn = new Date().toLocaleString();

  // Several parties print as several sheets — one account per page is what
  // makes them handable to different people.
  const sheets = ledgers
    .map(
      (l, i) => `
      <div class="page${i < ledgers.length - 1 ? " break" : ""}">
        <header class="sheet-head">
          <div>
            <div class="shop">${esc(shop.name)}</div>
            ${shop.address ? `<div class="muted">${esc(shop.address)}</div>` : ""}
            ${shop.phone ? `<div class="muted">${esc(shop.phone)}</div>` : ""}
          </div>
          <div class="right">
            <div class="doc">Ledger statement</div>
            ${subtitle ? `<div class="muted">${esc(subtitle)}</div>` : ""}
            <div class="muted">Printed ${esc(printedOn)}</div>
          </div>
        </header>
        ${statementBody(l, currency)}
      </div>`,
    )
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Ledger statement</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Arial, Helvetica, "Segoe UI", sans-serif;
    color: #111;
    font-size: 12px;
  }
  .page { padding: 0 0 8mm; }
  /* Each account starts its own sheet so they can be handed out separately. */
  .break { page-break-after: always; }
  .sheet-head {
    display: flex; justify-content: space-between; align-items: flex-start;
    gap: 12mm; border-bottom: 2px solid #111; padding-bottom: 4mm; margin-bottom: 5mm;
  }
  .shop { font-size: 18px; font-weight: 700; }
  .doc { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
  .right { text-align: right; }
  .muted { color: #555; font-size: 11px; }
  .center { text-align: center; }
  .party { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4mm; }
  .party-name { font-size: 15px; font-weight: 700; }
  .tag { font-size: 11px; font-weight: 700; padding: 2px 8px; border: 1px solid #111; border-radius: 999px; }
  .tag.pay { background: #111; color: #fff; }
  table.entries { width: 100%; border-collapse: collapse; }
  table.entries th, table.entries td { border-bottom: 1px solid #ddd; padding: 5px 6px; vertical-align: top; }
  table.entries th { border-bottom: 1px solid #111; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
  table.entries .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  tr.opening td { font-weight: 600; background: #f6f6f6; }
  .totals { margin-top: 5mm; margin-left: auto; width: 78mm; }
  .totals div { display: flex; justify-content: space-between; padding: 3px 0; }
  .totals .grand { border-top: 2px solid #111; margin-top: 3px; padding-top: 5px; font-size: 14px; font-weight: 700; }
  .sign { display: flex; gap: 16mm; margin-top: 14mm; }
  .sign div { flex: 1; font-size: 11px; color: #555; }
  .sign span { display: block; border-top: 1px solid #111; margin-bottom: 3px; height: 12mm; }
</style>
</head>
<body>
  ${sheets || `<div class="page"><p class="center muted">Nothing to print.</p></div>`}
  <script>
    window.onload = function () {
      window.print();
    };
  </script>
</body>
</html>`;
}
