import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useShop } from "@/contexts/ShopContext";
import { format } from "date-fns";

export interface LabTokenOrder {
  id: string;
  token_number: string;
  test_name: string;
  patient_name: string | null;
  patient_phone: string | null;
  patient_age: string | null;
  patient_gender: string | null;
  created_at: string;
}

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const buildTokenPrintHtml = (orders: LabTokenOrder[], shop: { name?: string; address?: string | null; phone?: string | null }) =>
  `<!doctype html>
  <html><head><meta charset="utf-8" /><title>Lab token</title>
  <style>
    @page { margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000;
      font-family: "Courier New", Courier, monospace; }
    body { width: 80mm; margin: 0 auto; }
    .slip { width: 72mm; margin: 0 auto; padding: 4mm 0 6mm; font-size: 12px; line-height: 1.35;
      page-break-after: always; }
    .slip:last-child { page-break-after: auto; }
    .center { text-align: center; }
    .title { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
    .token { font-size: 30px; font-weight: 700; letter-spacing: 0.06em; margin: 3mm 0; }
    .small { font-size: 11px; }
    .rule { border-top: 1px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; gap: 6px; }
    .row span:last-child { text-align: right; word-break: break-word; }
  </style></head><body>
  ${orders.map((o) => `
    <div class="slip">
      <div class="center title">${esc(shop.name ?? "Laboratory")}</div>
      ${shop.address ? `<div class="center small">${esc(shop.address)}</div>` : ""}
      ${shop.phone ? `<div class="center small">Ph: ${esc(shop.phone)}</div>` : ""}
      <div class="rule"></div>
      <div class="center small">LAB TOKEN</div>
      <div class="center token">${esc(o.token_number)}</div>
      <div class="rule"></div>
      <div class="row"><span>Patient</span><span>${esc(o.patient_name || "—")}</span></div>
      <div class="row"><span>Age / Sex</span><span>${esc([o.patient_age, o.patient_gender].filter(Boolean).join(" / ") || "—")}</span></div>
      <div class="row"><span>Phone</span><span>${esc(o.patient_phone || "—")}</span></div>
      <div class="row"><span>Test</span><span>${esc(o.test_name)}</span></div>
      <div class="row"><span>Date</span><span>${esc(format(new Date(o.created_at), "Pp"))}</span></div>
      <div class="rule"></div>
      <div class="center small">Please keep this slip to collect your report.</div>
    </div>`).join("")}
  <script>
    window.onload = () => { setTimeout(() => { window.focus(); window.print();
      setTimeout(() => window.parent.postMessage("lab-token-print-done", "*"), 300); }, 150); };
  </script>
  </body></html>`;

/**
 * The slip handed to the patient when a lab test is rung up: the queue token
 * plus the patient details captured at checkout, so the counter and the lab
 * agree on who the sample belongs to.
 */
export function LabTokenDialog({ orders, onClose }: { orders: LabTokenOrder[] | null; onClose: () => void }) {
  const { currentShop } = useShop();
  if (!orders || orders.length === 0) return null;

  const print = () => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, {
      position: "fixed", right: "0", bottom: "0", width: "0", height: "0",
      opacity: "0", pointerEvents: "none",
    });
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      setTimeout(() => iframe.remove(), 100);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source === iframe.contentWindow && e.data === "lab-token-print-done") cleanup();
    };
    window.addEventListener("message", onMessage);
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { cleanup(); window.print(); return; }
    doc.open();
    doc.write(buildTokenPrintHtml(orders, {
      name: currentShop?.name, address: currentShop?.address, phone: currentShop?.phone,
    }));
    doc.close();
    setTimeout(cleanup, 60000);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-white text-black">
        <div className="px-4 pt-5 pb-2 max-h-[70vh] overflow-y-auto">
          {orders.map((o) => (
            <div key={o.id} className="w-full max-w-[72mm] mx-auto font-mono text-[12px] leading-[1.35] mb-4">
              <div className="text-center font-bold uppercase tracking-[0.08em]">{currentShop?.name}</div>
              {currentShop?.address && <div className="text-center text-[11px]">{currentShop.address}</div>}
              <div className="border-t border-dashed border-black my-2" />
              <div className="text-center text-[11px]">LAB TOKEN</div>
              <div className="text-center text-3xl font-bold tracking-widest my-2">{o.token_number}</div>
              <div className="border-t border-dashed border-black my-2" />
              <div className="space-y-0.5 text-[11px]">
                <div className="flex justify-between gap-2"><span>Patient</span><span className="text-right">{o.patient_name || "—"}</span></div>
                <div className="flex justify-between gap-2"><span>Age / Sex</span><span className="text-right">{[o.patient_age, o.patient_gender].filter(Boolean).join(" / ") || "—"}</span></div>
                <div className="flex justify-between gap-2"><span>Phone</span><span className="text-right">{o.patient_phone || "—"}</span></div>
                <div className="flex justify-between gap-2"><span>Test</span><span className="text-right">{o.test_name}</span></div>
                <div className="flex justify-between gap-2"><span>Date</span><span className="text-right">{format(new Date(o.created_at), "Pp")}</span></div>
              </div>
              <div className="border-t border-dashed border-black my-2" />
              <div className="text-center text-[11px]">Please keep this slip to collect your report.</div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 p-3 border-t bg-white">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={print}><Printer className="size-4 mr-1" /> Print token</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
