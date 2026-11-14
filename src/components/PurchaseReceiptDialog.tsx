/**
 * The purchase voucher — opened from a purchase's details, with Print and
 * WhatsApp (to the supplier) like the sale and return slips (Ctrl/Cmd+P,
 * Alt+W). What it prints follows Settings → Receipt → Purchase receipt.
 *
 * ⚠️ COPIED VERBATIM to the desktop app. The desktop passes its own `print`
 * (the main-process thermal path); the web prints through a hidden frame.
 */
import { useEffect } from "react";
import { toast } from "sonner";
import { MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatAmount, formatMoney } from "@/lib/format";
import { openWhatsApp } from "@/lib/whatsapp-open";
import { printHtmlPage } from "@/components/ReturnReceiptDialog";
import { matchPosShortcut } from "@/lib/pos-shortcuts";
import { fmtDateTime } from "@/lib/date-format";
import {
  buildPurchaseMessage,
  buildPurchasePrintHtml,
  payableLine,
  purchaseSlipLedger,
  purchaseSlipLogo,
  purchaseSlipOptions,
  purchaseUnpaid,
  type PurchaseSlip,
} from "@/lib/purchase-receipt";

export function PurchaseReceiptDialog({
  slip,
  onClose,
  print: printHtml,
}: {
  slip: PurchaseSlip | null;
  onClose: () => void;
  /** How this app prints a slip's HTML. Default: a hidden frame. */
  print?: (html: string) => void | Promise<void>;
}) {
  const print = () => {
    if (!slip) return;
    const html = buildPurchasePrintHtml(slip, formatMoney, fmtDateTime(slip.created_at));
    void Promise.resolve((printHtml ?? printHtmlPage)(html))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not print"));
  };
  const sendWhatsApp = () => {
    if (!slip) return;
    if (!slip.supplier?.phone) return toast.error("No phone number for this supplier");
    if (!openWhatsApp(slip.supplier.phone, buildPurchaseMessage(slip, formatMoney, fmtDateTime(slip.created_at)))) {
      toast.error("That phone number doesn't look like a WhatsApp number");
    }
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
      {/* Only the paper scrolls, so the buttons stay on screen for a long bill. */}
      <DialogContent
        data-enter-chain="off"
        className="sm:max-w-md p-0 sm:p-0 md:p-0 gap-0 overflow-hidden bg-white text-black flex flex-col max-h-[100dvh] sm:max-h-[calc(100dvh-2rem)]"
      >
        <div className="px-4 pt-5 pb-3 flex justify-center flex-1 min-h-0 overflow-y-auto">
          {slip && <PurchaseSlipPaper slip={slip} />}
        </div>
        <div className="flex gap-2 p-4 border-t border-gray-200 bg-gray-50 shrink-0">
          <Button variant="outline" className="flex-1 border-gray-300 bg-white text-gray-900 hover:bg-gray-100 hover:text-gray-900" onClick={onClose}>
            Close
          </Button>
          {slip?.supplier?.phone && (
            <Button variant="outline" className="flex-1 border-gray-300 bg-white text-gray-900 hover:bg-gray-100 hover:text-gray-900" onClick={sendWhatsApp}>
              <MessageCircle className="size-4 mr-2" /> WhatsApp
            </Button>
          )}
          <Button className="flex-1 bg-gradient-primary text-white border-0 hover:opacity-90" onClick={print}>
            <Printer className="size-4 mr-2" /> Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The voucher as it looks on screen — the dialog and the Settings preview both
 * draw it, so the switches there show exactly what will print.
 */
export function PurchaseSlipPaper({ slip }: { slip: PurchaseSlip }) {
  const cur = slip.shop.currency;
  const o = purchaseSlipOptions(slip);
  const logo = purchaseSlipLogo(slip);
  const led = purchaseSlipLedger(slip);
  const unpaid = purchaseUnpaid(slip);
  const row = (label: string, value: string, cls = "") => (
    <div className={"flex justify-between gap-2 " + cls}>
      <span className="shrink-0">{label}</span>
      <span className="text-right break-words tabular-nums">{value}</span>
    </div>
  );
  return (
    <div dir="ltr" className="w-full max-w-[72mm] mx-auto bg-white text-black font-sans font-bold text-[13px] leading-[1.45] [font-variant-numeric:tabular-nums]">
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element -- the shop's own upload, printed as-is
        <img src={logo} alt="" className="mx-auto mb-1.5 block max-h-[22mm] max-w-[48mm] object-contain" />
      )}
      <div className="text-center">
        <div className="font-bold text-base uppercase tracking-[0.08em]">{slip.shop.name}</div>
        {slip.shop.address && <div className="text-[11px] whitespace-pre-line break-words">{slip.shop.address}</div>}
        {slip.shop.phone && <div className="text-[11px]">{slip.shop.phone}</div>}
      </div>
      <div className="border-t border-black my-2" />
      <div className="text-center text-[11px]">PURCHASE VOUCHER</div>
      <div className="text-[11px] space-y-0.5">
        {row("Voucher", slip.reference_number ?? "")}
        {row("Date", fmtDateTime(slip.created_at))}
        {o.show_supplier && slip.supplier && row("Supplier", slip.supplier.name)}
        {o.show_supplier && slip.supplier?.phone && row("Phone", slip.supplier.phone)}
      </div>
      <div className="border-t border-black my-2" />
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left font-bold py-0.5">Description</th>
            <th className="text-right font-bold pl-1.5">Qty</th>
            {o.show_unit_cost && <th className="text-right font-bold pl-1.5">@</th>}
            <th className="text-right font-bold pl-1.5">Amt</th>
          </tr>
        </thead>
        <tbody className="font-normal">
          {slip.items.map((it, i) => (
            <tr key={i} className="align-top">
              <td className="py-0.5 break-words [overflow-wrap:anywhere]">{it.product_name}</td>
              <td className="text-right pl-1.5 whitespace-nowrap">{Number(Number(it.quantity).toFixed(3))}</td>
              {o.show_unit_cost && <td className="text-right pl-1.5 whitespace-nowrap">{formatAmount(it.unit_cost, cur)}</td>}
              <td className="text-right pl-1.5 whitespace-nowrap">{formatAmount(it.line_total, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-black my-2" />
      <div className="space-y-0.5 text-[11px]">
        {row("Subtotal", formatMoney(slip.subtotal, cur))}
        {o.show_expenses && slip.expenses_total > 0 && row("Expenses", formatMoney(slip.expenses_total, cur))}
        {slip.tax > 0 && row("Tax", formatMoney(slip.tax, cur))}
        {row("TOTAL", formatMoney(slip.total, cur), "text-[13px] font-bold border-t border-black mt-1 pt-1")}
        {row(`Paid${slip.account_name ? ` (${slip.account_name})` : ""}`, formatMoney(slip.paid, cur))}
        {led ? (
          <>
            <div className="border-t border-black my-1.5" />
            {row(payableLine(led.previous).label, formatMoney(payableLine(led.previous).amount, cur))}
            {row("This bill (unpaid)", formatMoney(led.bill, cur))}
            {row(payableLine(led.after, true).label, formatMoney(payableLine(led.after, true).amount, cur), "text-[13px] font-bold border-t border-black mt-1 pt-1")}
          </>
        ) : unpaid > 0 ? row("Balance due", formatMoney(unpaid, cur)) : null}
      </div>
      {o.show_notes && slip.notes && (
        <>
          <div className="border-t border-black my-2" />
          <div className="text-[11px] whitespace-pre-line break-words">Note: {slip.notes}</div>
        </>
      )}
      {o.show_signature && <div className="text-[11px] mt-4">Received by ________________</div>}
      {slip.shop.receipt_footer && (
        <>
          <div className="border-t border-black my-2" />
          <div className="text-center text-[11px] whitespace-pre-line">{slip.shop.receipt_footer}</div>
        </>
      )}
      <div className="text-center text-[11px] mt-2">** Goods received **</div>
    </div>
  );
}
