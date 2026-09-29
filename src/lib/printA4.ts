/**
 * Reports, ledger statements and count sheets as A4 PDFs.
 *
 * ⚠️ In the desktop app these are rendered to an A4 PDF by the main process
 * and opened in the default PDF viewer, where the shop prints or saves it. The renderer's own `window.print()` lays the page out on the
 * chosen printer's default paper — for a shop with an 80mm receipt printer
 * that meant A4 reports laid out 80mm wide, two columns and the names cut off
 * (SHAMSHER CORPORATION), while "Save as PDF" came out right.
 *
 * Outside Electron (a plain browser build) the old paths remain.
 */
import { stripAutoPrint } from "@/lib/printThermal";

/**
 * The current page (the Reports screen, whose print CSS shows only the report)
 * as an A4 PDF, opened in the system's PDF viewer. Throws when it can't, so the
 * caller can say so rather than doing nothing.
 */
export async function printCurrentPageA4(name = "report"): Promise<void> {
  const api = window.electronAPI;
  if (api?.printCurrentPageA4) {
    const res = await api.printCurrentPageA4(name);
    if (!res?.success) throw new Error(res?.reason || "Could not open the PDF.");
    return;
  }
  window.print();
}

/** A complete A4 document (its own <html>) as a PDF, opened in the system's PDF viewer. */
export async function printDocumentA4(html: string, name = "document"): Promise<void> {
  const api = window.electronAPI;
  if (api?.printDocumentA4) {
    // The builders embed an onload window.print(); the PDF path must not run it.
    const res = await api.printDocumentA4(stripAutoPrint(html), name);
    if (!res?.success) throw new Error(res?.reason || "Could not open the PDF.");
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
