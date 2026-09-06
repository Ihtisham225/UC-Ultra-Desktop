/**
 * The receivable / payable summary — one line per party, the way the shop's
 * previous software printed it.
 *
 * Distinct from the per-party statement in `ledger-statement.ts`: that one is
 * a sheet you hand to a customer to settle up, this one is the whole book at a
 * glance, which is what gets checked against the accountant's figures. Both
 * are wanted; they answer different questions.
 *
 * Money is shown in the column the balance falls on — what the shop is owed on
 * one side, what it owes on the other — with a running total down each, so any
 * line can be reconciled against the page above it.
 */

export interface SummaryLedger {
  person_name: string;
  phone: string | null;
  direction: string;
  amount: number;
  paid_amount: number;
}

export interface SummaryShop {
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

/** Grouped, 2dp. The currency is named once in the header, not per cell. */
const amt = (n: number) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function buildLedgerSummaryHtml(args: {
  shop: SummaryShop;
  ledgers: SummaryLedger[];
  currency: string;
  /** Shown under the title, e.g. which list this was printed from. */
  subtitle?: string;
}): string {
  const { shop, ledgers, currency, subtitle } = args;
  const printedOn = new Date().toLocaleString();

  // Alphabetical, like the book it replaces — the shop looks a party up by
  // name, never by when the account was opened.
  const rows = [...ledgers].sort((a, b) =>
    a.person_name.localeCompare(b.person_name, undefined, { sensitivity: "base" }),
  );

  let runReceivable = 0;
  let runPayable = 0;

  const body = rows
    .map((l) => {
      // What is actually left on the account. Clamped per row: an overpaid
      // account is not a debt in the other direction, and letting it go
      // negative would quietly cancel out somebody else's balance.
      const outstanding = Math.max(l.amount - l.paid_amount, 0);
      const receivable = l.direction === "owed_to_me" ? outstanding : 0;
      const payable = l.direction === "owed_to_me" ? 0 : outstanding;
      runReceivable += receivable;
      runPayable += payable;
      return `
        <tr>
          <td>${esc(l.person_name)}${l.phone ? `<span class="muted"> · ${esc(l.phone)}</span>` : ""}</td>
          <td class="num">${receivable ? amt(receivable) : ""}</td>
          <td class="num">${payable ? amt(payable) : ""}</td>
          <td class="num run">${amt(runReceivable)}</td>
          <td class="num run">${amt(runPayable)}</td>
        </tr>`;
    })
    .join("");

  const net = runReceivable - runPayable;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Receivable / Payable</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, "Segoe UI", sans-serif; color: #111; font-size: 11px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 10mm;
           border-bottom: 2px solid #111; padding-bottom: 3mm; margin-bottom: 4mm; }
  .shop { font-size: 17px; font-weight: 700; }
  .doc { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
  .right { text-align: right; }
  .muted { color: #666; font-weight: 400; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #ddd; padding: 3px 5px; vertical-align: top; }
  th { border-bottom: 1.5px solid #111; text-align: left; font-size: 10px;
       text-transform: uppercase; letter-spacing: .03em; }
  /* The header repeats when the table runs past one sheet, so page two is
     still readable on its own. */
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .run { color: #555; }
  tfoot td { border-top: 2px solid #111; border-bottom: none; font-weight: 700; font-size: 12px; padding-top: 5px; }
  .net { margin-top: 4mm; text-align: right; font-size: 12px; }
  .net b { font-size: 14px; }
</style>
</head>
<body>
  <header>
    <div>
      <div class="shop">${esc(shop.name)}</div>
      ${shop.address ? `<div class="muted">${esc(shop.address)}</div>` : ""}
      ${shop.phone ? `<div class="muted">${esc(shop.phone)}</div>` : ""}
    </div>
    <div class="right">
      <div class="doc">Receivable / Payable</div>
      ${subtitle ? `<div class="muted">${esc(subtitle)}</div>` : ""}
      <div class="muted">${esc(rows.length)} accounts · ${esc(currency)}</div>
      <div class="muted">Printed ${esc(printedOn)}</div>
    </div>
  </header>

  <table>
    <thead>
      <tr>
        <th>Particulars</th>
        <th class="num">Receivable</th>
        <th class="num">Payable</th>
        <th class="num">Total receivable</th>
        <th class="num">Total payable</th>
      </tr>
    </thead>
    <tbody>
      ${body || `<tr><td colspan="5" style="text-align:center;color:#666;padding:8mm">No accounts to show.</td></tr>`}
    </tbody>
    <tfoot>
      <tr>
        <td>Total</td>
        <td class="num">${amt(runReceivable)}</td>
        <td class="num">${amt(runPayable)}</td>
        <td class="num"></td>
        <td class="num"></td>
      </tr>
    </tfoot>
  </table>

  <div class="net">
    ${net >= 0 ? "Net receivable" : "Net payable"}:
    <b>${esc(currency)} ${amt(Math.abs(net))}</b>
  </div>

  <script>
    window.onload = function () { window.print(); };
  </script>
</body>
</html>`;
}
