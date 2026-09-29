/**
 * A4 printing for reports, ledger statements and count sheets.
 *
 * ⚠️ In the desktop app these go through the main process with the paper
 * fixed to A4. The renderer's own `window.print()` lays the page out on the
 * chosen printer's default paper — for a shop with an 80mm receipt printer
 * that meant A4 reports laid out 80mm wide, two columns and the names cut off
 * (SHAMSHER CORPORATION), while "Save as PDF" came out right.
 *
 * Outside Electron (a plain browser build) the old paths remain.
 */
import { stripAutoPrint } from "@/lib/printThermal";

/** Print the current page — the Reports screen, whose print CSS shows only the report. */
export async function printCurrentPageA4(): Promise<void> {
  const api = window.electronAPI;
  if (api?.printCurrentPageA4) {
    await api.printCurrentPageA4();
    return;
  }
  window.print();
}

/** Print a complete A4 document (its own <html>, which may carry an auto-print hook). */
export async function printDocumentA4(html: string): Promise<void> {
  const api = window.electronAPI;
  if (api?.printDocumentA4) {
    // The builders embed an onload window.print(); the main process prints
    // itself, so that hook would fire a second job.
    await api.printDocumentA4(stripAutoPrint(html));
    return;
  }
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  // Parked off-screen at a real A4 width rather than 0x0: a zero-sized frame
  // lays its document out in a zero-width viewport.
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;opacity:0;pointer-events:none;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    throw new Error("Could not open the print view.");
  }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => iframe.remove(), 60_000);
}
