/**
 * A4 ledger statements — one party, or every party in one run.
 *
 * The shop hands these to a customer to settle up, so the document has to
 * stand on its own: who it is for, what they were billed, what they have paid
 * and when, and what is left. Printed through the browser, which is also how
 * it becomes a PDF ("Save as PDF" in the print dialog).
 */

import { personLedgerLog } from "@/lib/ledger-log";

export interface StatementPayment {
  id: string;
  /** The khata row (bill) the entry was taken against. */
  debt_id: string;
  payment_date: string;
  created_at?: string | null;
  amount: number;
  discount: number;
  kind: string;
  notes: string | null;
  account_name?: string | null;
}

/** One khata row of the person's account — usually one bill. */
export interface StatementBill {
  id: string;
  amount: number;
  created_at: string;
  /** "Bill ORD-214", "Purchase INV-9", or the entry's own note. */
  label: string;
  /** Shown under the label, e.g. "Credit sale (partial paid 30000)". */
  notes?: string | null;
}

export interface StatementLedger {
  person_name: string;
  phone: string | null;
  direction: string;
  amount: number;
  paid_amount: number;
  notes: string | null;
  bills: StatementBill[];
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

/** A yyyy-mm-dd as the shop writes a date: 14/09/2026. */
const dmy = (v: string) => (/^\d{4}-\d{2}-\d{2}/.test(v) ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : v);

function statementBody(ledger: StatementLedger, currency: string): string {
  const owedToUs = ledger.direction === "owed_to_me";
  // ⚠️ The SAME history the Ledger's details dialog shows (personLedgerLog):
  // every bill on the day it was raised, then each "added" entry and payment,
  // balance carried down the page from zero. The sheet used to open with one
  // "total billed" lump and list only payments, so a customer holding the
  // statement couldn't see which bills made up what they owed — and it didn't
  // match the account screen they'd just been shown.
  const log = personLedgerLog(
    ledger.bills.map((b) => ({ id: b.id, amount: b.amount, created_at: b.created_at, label: b.label })),
    ledger.payments,
  );
  const billNotes = new Map(ledger.bills.map((b) => [`bill:${b.id}`, b.notes?.trim() || null]));

  const rows = log.rows
    .map((r) => {
      const detail =
        r.kind === "bill" ? esc(r.label ?? "Bill") : r.kind === "increase" ? "Added to account" : "Payment";
      const sub = [r.kind === "bill" ? billNotes.get(r.id) : r.notes, r.account_name ? `via ${r.account_name}` : null]
        .filter(Boolean)
        .map((t) => esc(t))
        .join(" · ");
      const charge = r.kind !== "payment";
      return `
        <tr>
          <td>${esc(dmy(r.date))}</td>
          <td>${detail}${sub ? `<div class="sub">${sub}</div>` : ""}</td>
          <td class="num">${charge ? amt(r.amount) : ""}</td>
          <td class="num">${charge ? "" : amt(r.amount)}</td>
          <td class="num">${r.discount > 0 ? amt(r.discount) : ""}</td>
          <td class="num">${amt(r.balance_after)}</td>
        </tr>`;
    })
    .join("");

  const { billed, added, paid, discount } = log.totals;
  const remaining = Math.max(log.closing, 0);

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
          ${rows || `<tr><td colspan="6" class="muted center">Nothing recorded yet.</td></tr>`}
        </tbody>
      </table>

      <div class="totals">
        <div><span>Total billed</span><b>${amt(billed + added)}</b></div>
        <div><span>${owedToUs ? "Received" : "Paid"}</span><b>${amt(paid)}</b></div>
        ${discount > 0 ? `<div><span>Discount given</span><b>${amt(discount)}</b></div>` : ""}
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
  table.entries .sub { color: #555; font-size: 10.5px; margin-top: 1px; }
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
