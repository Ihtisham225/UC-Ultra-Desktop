import { useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { MessageCircle, Printer, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { buildWaReminderUrl } from "@/lib/debt-reminder";
import { buildReturnMessage, buildReturnPrintHtml, balanceAfterLabel, refundedVia, returnSlipBalance, returnSlipLedger, type ReturnSlip } from "@/lib/return-receipt";
import { matchPosShortcut } from "@/lib/pos-shortcuts";

/** Print a standalone HTML page through a hidden frame, like the sale receipt. */
export function printHtmlPage(html: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", opacity: "0", pointerEvents: "none" });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    window.print();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => iframe.remove(), 60000);
}

/**
 * The return's receipt — opened straight after a return is taken, the way the
 * sale receipt opens after checkout, with the same Print and WhatsApp choices
 * (and the same Ctrl/Cmd+P).
 */
export function ReturnReceiptDialog({ slip, onClose }: { slip: ReturnSlip | null; onClose: () => void }) {
  const date = slip ? format(new Date(slip.created_at), "dd/MM/yyyy h:mm a") : "";
  const cur = slip?.shop.currency ?? "USD";

  const print = () => {
    if (slip) printHtmlPage(buildReturnPrintHtml(slip, formatMoney, date));
  };
  const sendWhatsApp = () => {
    if (!slip) return;
    if (!slip.customer?.phone) return toast.error("This bill has no customer phone number");
    const url = buildWaReminderUrl(slip.customer.phone, buildReturnMessage(slip, formatMoney, date));
    if (!url) return toast.error("That phone number doesn't look like a WhatsApp number");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    if (!slip) return;
    const onKey = (e: KeyboardEvent) => {
      const hit = matchPosShortcut(e);
      if (hit !== "print" && hit !== "whatsapp") return;
      e.preventDefault();
      e.stopPropagation();
      if (hit === "print") print();
      else sendWhatsApp();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  return (
    <Dialog open={!!slip} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-enter-chain="off" className="sm:max-w-md bg-white text-black">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-black">
            <Undo2 className="size-5" /> Return {slip?.return_number}
          </DialogTitle>
        </DialogHeader>
        {slip && (
          <div className="font-mono text-xs border border-gray-200 rounded-md p-3 space-y-2 max-h-[55vh] overflow-y-auto">
            <div className="text-center font-bold text-sm">{slip.shop.name}</div>
            <div className="text-center">RETURN RECEIPT</div>
            <div className="flex justify-between"><span>Date</span><span>{date}</span></div>
            {slip.sale_receipt_number && (
              <div className="flex justify-between"><span>Against bill</span><span>{slip.sale_receipt_number}</span></div>
            )}
            {slip.customer && <div className="flex justify-between"><span>Customer</span><span>{slip.customer.name}</span></div>}
            <div className="border-t border-gray-300" />
            {slip.items.map((i, idx) => (
              <div key={idx} className="flex justify-between gap-2">
                <span className="truncate">{Number(i.quantity.toFixed(3))} × {i.product_name}</span>
                <span className="tabular-nums shrink-0">{formatMoney(i.line_total, cur)}</span>
              </div>
            ))}
            <div className="border-t border-gray-300" />
            {slip.deduction > 0 && (
              <>
                <div className="flex justify-between"><span>Items</span><span>{formatMoney(slip.items_total, cur)}</span></div>
                <div className="flex justify-between"><span>Deduction</span><span>-{formatMoney(slip.deduction, cur)}</span></div>
              </>
            )}
            <div className="flex justify-between font-bold text-sm"><span>REFUNDED</span><span>{formatMoney(slip.total_refund, cur)}</span></div>
            <div className="flex justify-between"><span>Via</span><span>{refundedVia(slip)}</span></div>
            {(() => {
              const led = returnSlipLedger(slip);
              if (led) {
                const after = balanceAfterLabel(led.after);
                return (
                  <div className="border-t border-gray-300 pt-2 space-y-1">
                    <div className="flex justify-between"><span>Previous balance</span><span>{formatMoney(led.previous, cur)}</span></div>
                    <div className="flex justify-between font-bold"><span>{after.label}</span><span>{formatMoney(after.amount, cur)}</span></div>
                  </div>
                );
              }
              const owed = returnSlipBalance(slip);
              return owed !== null ? (
                <div className="flex justify-between border-t border-gray-300 pt-2">
                  <span>Previous balance</span><span>{formatMoney(owed, cur)}</span>
                </div>
              ) : null;
            })()}
            {slip.reason && <div>Reason: {slip.reason}</div>}
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          {slip?.customer?.phone && (
            <Button variant="outline" onClick={sendWhatsApp} className="border-gray-300 bg-white text-gray-900 hover:bg-gray-100">
              <MessageCircle className="size-4 mr-2" /> WhatsApp
            </Button>
          )}
          <Button variant="outline" onClick={print} className="border-gray-300 bg-white text-gray-900 hover:bg-gray-100">
            <Printer className="size-4 mr-2" /> Print
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
