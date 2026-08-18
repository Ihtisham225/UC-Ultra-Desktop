/**
 * Print a thermal slip (sale receipt, purchase voucher, lab token).
 *
 * In the desktop app this goes through the main process, NOT the renderer's
 * `window.print()`. The two are not equivalent: a browser honours
 * `@page { margin: 0 }`, but Electron's print path imposes its default page
 * margins, which inset the slip so its right edge falls outside an 80mm head's
 * 72mm print window and the last character of every line is cut off. Only the
 * main process can force `marginType: 'none'`.
 *
 * The hidden iframe remains as the fallback for a browser build and for the
 * case where the Electron bridge is missing.
 */
export async function printThermalHtml(html: string): Promise<void> {
  const api = window.electronAPI;
  // Show it first — Electron has no print preview and the Windows print
  // dialog shows only printer and copies, so this is the only chance to see
  // the slip before it hits paper. Printing happens from that window.
  if (api?.previewReceipt) {
    await api.previewReceipt(stripAutoPrint(html));
    return;
  }
  if (api?.printReceipt) {
    // The builders embed an onload hook that calls window.print(); the main
    // process drives printing itself, so that would fire a second job.
    await api.printReceipt(stripAutoPrint(html));
    return;
  }
  printViaIframe(html);
}

/** Removes the self-printing <script> block the print HTML carries. */
export function stripAutoPrint(html: string): string {
  return html.replace(/<script>[\s\S]*?<\/script>/gi, "");
}

function printViaIframe(html: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed", right: "0", bottom: "0", width: "0", height: "0",
    opacity: "0", pointerEvents: "none",
  } as CSSStyleDeclaration);

  const cleanup = () => {
    window.removeEventListener("message", onMessage);
    setTimeout(() => iframe.remove(), 100);
  };
  const onMessage = (e: MessageEvent) => {
    if (e.source === iframe.contentWindow && e.data === "thermal-print-done") cleanup();
  };
  window.addEventListener("message", onMessage);
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) { cleanup(); window.print(); return; }

  doc.open();
  doc.write(html.replace(
    "window.print();",
    'window.print();\nsetTimeout(() => window.parent.postMessage("thermal-print-done", "*"), 300);',
  ));
  doc.close();
  setTimeout(cleanup, 60000);
}
