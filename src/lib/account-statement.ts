/**
 * A money account's statement for a date range — what the Accounts history
 * dialog prints.
 *
 * The figures come from the history the dialog already holds (every entry with
 * the balance after it), so the printed sheet and the screen cannot disagree:
 * the opening balance is the balance just before the first day of the range,
 * and every line's balance is the one the screen shows.
 *
 * Pure apart from the date formatting, so it can be tested on its own.
 * ⚠️ COPIED verbatim to the desktop app.
 */
import { fmtDate, fmtDateTime } from "@/lib/date-format";

export interface StatementEntry {
  id: string;
  /** yyyy-mm-dd */
  date: string;
  /** Signed: money in is positive, money out negative. */
  amount: number;
  /** Balance right after this entry. */
  running: number;
  label: string;
  note: string | null;
}

export interface AccountStatement {
  /** Balance at the start of `from` (the account's opening balance when there is no `from`). */
  opening: number;
  /** Oldest first, as a statement reads. */
  rows: StatementEntry[];
  moneyIn: number;
  moneyOut: number;
  closing: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Narrow the history to `from`..`to` (inclusive yyyy-mm-dd; either may be
 * empty for "no limit"). `entries` may come in any order — they are put in the
 * order the server computed their running balances (oldest first; same-day
 * entries keep their given relative order, reversed if given newest first).
 */
export function accountStatement(
  entries: StatementEntry[],
  openingBalance: number,
  from: string,
  to: string,
  newestFirst = true,
): AccountStatement {
  const chronological = newestFirst ? [...entries].reverse() : [...entries];
  let opening = openingBalance;
  const rows: StatementEntry[] = [];
  for (const e of chronological) {
    if (from && e.date < from) {
      opening = e.running;
      continue;
    }
    if (to && e.date > to) continue;
    rows.push(e);
  }
  const moneyIn = round2(rows.reduce((a, r) => a + (r.amount > 0 ? r.amount : 0), 0));
  const moneyOut = round2(rows.reduce((a, r) => a + (r.amount < 0 ? -r.amount : 0), 0));
  return { opening, rows, moneyIn, moneyOut, closing: round2(opening + moneyIn - moneyOut) };
}

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Grouped, 2dp, no currency symbol — the currency is named once on the sheet. */
const amt = (n: number) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "01/10/2026 – 22/10/2026", "From 01/10/2026", "Up to 22/10/2026" or "All dates". */
export function statementPeriod(from: string, to: string): string {
  if (from && to) return `${fmtDate(from)} – ${fmtDate(to)}`;
  if (from) return `From ${fmtDate(from)}`;
  if (to) return `Up to ${fmtDate(to)}`;
  return "All dates";
}

/** The A4 sheet. Prints itself on load (the desktop's PDF path strips that). */
export function buildAccountStatementHtml(args: {
  shop: { name: string; phone?: string | null; address?: string | null };
  accountName: string;
  accountType: string;
  currency: string;
  statement: AccountStatement;
  from: string;
  to: string;
}): string {
  const { shop, accountName, accountType, currency, statement: s, from, to } = args;
  const rows = s.rows
    .map(
      (r) => `
        <tr>
          <td>${esc(fmtDate(r.date))}</td>
          <td>${esc(r.label)}${r.note ? `<div class="sub">${esc(r.note)}</div>` : ""}</td>
          <td class="num">${r.amount > 0 ? amt(r.amount) : ""}</td>
          <td class="num">${r.amount < 0 ? amt(-r.amount) : ""}</td>
          <td class="num">${amt(r.running)}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(accountName)} statement</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, "Segoe UI", sans-serif; color: #111; font-size: 12px; }
  .sheet-head {
    display: flex; justify-content: space-between; align-items: flex-start;
    gap: 12mm; border-bottom: 2px solid #111; padding-bottom: 4mm; margin-bottom: 5mm;
  }
  .shop { font-size: 18px; font-weight: 700; }
  .doc { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
  .right { text-align: right; }
  .muted { color: #555; font-size: 11px; }
  .center { text-align: center; }
  .account { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4mm; }
  .account-name { font-size: 15px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #ddd; padding: 5px 6px; vertical-align: top; }
  th { border-bottom: 1px solid #111; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .sub { color: #555; font-size: 10.5px; margin-top: 1px; }
  tr.carry td { font-weight: 700; background: #f4f4f4; }
  .totals { margin-top: 5mm; margin-left: auto; width: 78mm; }
  .totals div { display: flex; justify-content: space-between; padding: 3px 0; }
  .totals .grand { border-top: 2px solid #111; margin-top: 3px; padding-top: 5px; font-size: 14px; font-weight: 700; }
</style>
</head>
<body>
  <header class="sheet-head">
    <div>
      <div class="shop">${esc(shop.name)}</div>
      ${shop.address ? `<div class="muted">${esc(shop.address)}</div>` : ""}
      ${shop.phone ? `<div class="muted">${esc(shop.phone)}</div>` : ""}
    </div>
    <div class="right">
      <div class="doc">Account statement</div>
      <div class="muted">${esc(statementPeriod(from, to))}</div>
      <div class="muted">Printed ${esc(fmtDateTime(new Date()))}</div>
    </div>
  </header>

  <div class="account">
    <div class="account-name">${esc(accountName)}</div>
    <div class="muted">${esc(accountType)} · ${esc(currency)}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Date</th><th>Detail</th>
        <th class="num">Money in</th><th class="num">Money out</th><th class="num">Balance</th>
      </tr>
    </thead>
    <tbody>
      <tr class="carry">
        <td>${from ? esc(fmtDate(from)) : ""}</td><td>Opening balance</td><td></td><td></td>
        <td class="num">${amt(s.opening)}</td>
      </tr>
      ${rows || `<tr><td colspan="5" class="muted center">Nothing moved through this account in this period.</td></tr>`}
      <tr class="carry">
        <td>${to ? esc(fmtDate(to)) : ""}</td><td>Closing balance</td>
        <td class="num">${amt(s.moneyIn)}</td><td class="num">${amt(s.moneyOut)}</td>
        <td class="num">${amt(s.closing)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div><span>Opening balance</span><b>${amt(s.opening)}</b></div>
    <div><span>Money in</span><b>${amt(s.moneyIn)}</b></div>
    <div><span>Money out</span><b>${amt(s.moneyOut)}</b></div>
    <div class="grand"><span>Closing balance</span><b>${esc(currency)} ${amt(s.closing)}</b></div>
  </div>
  <script>
    window.onload = function () { window.print(); };
  </script>
</body>
</html>`;
}
