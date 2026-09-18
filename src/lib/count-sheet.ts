/**
 * A printable stock-count sheet for one shelf (or everything not on a shelf):
 * what the system says is there, and blank columns to write what's counted.
 * The counted figures go back in through the Inventory page's adjustment.
 *
 * A copy of the web app's `src/lib/count-sheet.ts` — keep the two in step.
 */

export interface CountSheetItem {
  name: string;
  sku: string | null;
  unit: string | null;
  stock: number;
  /** The exact shelf, when the sheet covers a rack with several. */
  place?: string;
}

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ""));

export function buildCountSheetHtml(args: { shopName: string; place: string; items: CountSheetItem[] }): string {
  const { shopName, place, items } = args;
  const showPlace = items.some((i) => i.place && i.place !== place);
  const rows = items
    .map(
      (i, n) => `
      <tr>
        <td class="n">${n + 1}</td>
        <td>${esc(i.name)}${i.sku ? `<div class="sub">${esc(i.sku)}</div>` : ""}</td>
        ${showPlace ? `<td class="sub">${esc(i.place ?? "")}</td>` : ""}
        <td class="num">${esc(qty(i.stock))} ${esc(i.unit ?? "")}</td>
        <td class="box"></td>
        <td class="box"></td>
      </tr>`,
    )
    .join("");
  return `<!doctype html>
<html><head><meta charset="utf-8" /><title>Count sheet — ${esc(place)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 3mm; margin-bottom: 4mm; }
  .shop { font-size: 16px; font-weight: 700; }
  .place { font-size: 14px; font-weight: 700; text-align: right; }
  .muted, .sub { color: #555; font-size: 10.5px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #ccc; padding: 6px; text-align: left; vertical-align: top; }
  th { border-bottom: 1px solid #111; font-size: 10.5px; text-transform: uppercase; letter-spacing: .03em; }
  .n { width: 8mm; color: #555; }
  .num { text-align: right; white-space: nowrap; }
  .box { width: 26mm; border-left: 1px solid #ddd; }
  footer { margin-top: 10mm; display: flex; gap: 16mm; font-size: 11px; color: #555; }
  footer div { flex: 1; border-top: 1px solid #111; padding-top: 2mm; }
</style></head>
<body>
  <header>
    <div><div class="shop">${esc(shopName)}</div><div class="muted">Stock count · ${esc(new Date().toLocaleDateString())}</div></div>
    <div class="place">${esc(place)}<div class="muted">${items.length} item${items.length === 1 ? "" : "s"}</div></div>
  </header>
  <table>
    <thead><tr><th class="n">#</th><th>Item</th>${showPlace ? "<th>Shelf</th>" : ""}<th class="num">System</th><th>Counted</th><th>Difference</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="6" class="muted">Nothing here.</td></tr>`}</tbody>
  </table>
  <footer><div>Counted by</div><div>Checked by</div></footer>
  <script>window.onload = function () { window.print(); };</script>
</body></html>`;
}
