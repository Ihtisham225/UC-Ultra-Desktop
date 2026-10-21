import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, MessageCircle, Printer, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { openWhatsApp } from "@/lib/whatsapp-open";
import { printHtmlPage } from "@/components/ReturnReceiptDialog";
import { buildOrderSlipHtml, buildOrderSlipMessage, orderSlipTitle, slipQty, type OrderSlipDto, type OrderSlipShop } from "@/lib/order-slip";
import { matchPosShortcut } from "@/lib/pos-shortcuts";
import { fmtDate, fmtDateTime } from "@/lib/date-format";

/**
 * A purchase order or a delivery order, ready to print or send — with or
 * without prices (the switch is remembered per kind on this computer).
 * Print and WhatsApp take the same keys as the receipts (Ctrl/Cmd+P, Alt+W).
 *
 * ⚠️ COPIED verbatim into the desktop (minus "use client").
 */
export function OrderSlipDialog({
  slip,
  shop,
  onClose,
}: {
  slip: OrderSlipDto | null;
  shop: OrderSlipShop | null;
  onClose: () => void;
}) {
  const kind = slip?.kind ?? "purchase";
  // A supplier usually gets the agreed rates; a driver's pass usually doesn't.
  // The last choice is remembered per kind on this computer. Read only while a
  // slip is open (always in the browser), so the server render never touches it.
  const [choice, setChoice] = useState<Partial<Record<OrderSlipDto["kind"], boolean>>>({});
  const stored = (k: OrderSlipDto["kind"]): boolean => {
    try {
      const v = localStorage.getItem(`ucu.orderSlipPrices.${k}`);
      if (v !== null) return v === "1";
    } catch { /* private window: use the default */ }
    return k === "purchase";
  };
  const withPrices = choice[kind] ?? (slip ? stored(kind) : kind === "purchase");
  const choosePrices = (v: boolean) => {
    setChoice((c) => ({ ...c, [kind]: v }));
    try { localStorage.setItem(`ucu.orderSlipPrices.${kind}`, v ? "1" : "0"); } catch { /* ignore */ }
  };

  const date = slip ? fmtDateTime(slip.created_at) : "";
  const cur = shop?.currency ?? "PKR";
  const words = orderSlipTitle(kind);

  // "Needed by" is stored as yyyy-mm-dd; print it the way the shop writes dates.
  const out = slip && slip.expected_date ? { ...slip, expected_date: fmtDate(slip.expected_date) } : slip;
  const print = () => {
    if (out && shop) printHtmlPage(buildOrderSlipHtml(out, shop, formatMoney, date, withPrices));
  };
  const send = (phone: string | null | undefined, who: string) => {
    if (!slip || !shop) return;
    if (!phone) return toast.error(`No phone number for the ${who} — add one to their record first`);
    if (!openWhatsApp(phone, buildOrderSlipMessage(out ?? slip, shop, formatMoney, date, withPrices))) {
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
      else send(slip.party_phone, kind === "purchase" ? "supplier" : "customer");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const line = (label: string, value: string) => (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <span className="text-right break-words">{value}</span>
    </div>
  );

  return (
    <Dialog open={!!slip} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-enter-chain="off" className="sm:max-w-md bg-white text-black">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-black">
            {kind === "purchase" ? <ClipboardList className="size-5" /> : <Truck className="size-5" />}
            {kind === "purchase" ? "Purchase order" : "Delivery order"} {slip?.number}
          </DialogTitle>
        </DialogHeader>
        {slip && (
          <>
            <div className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
              <Label htmlFor="slip-prices" className="text-sm text-gray-900">Show prices</Label>
              <Switch id="slip-prices" checked={withPrices} onCheckedChange={choosePrices} />
            </div>
            <div className="font-mono text-xs border border-gray-200 rounded-md p-3 space-y-1.5 max-h-[50vh] overflow-y-auto">
              <div className="text-center font-bold text-sm">{shop?.name}</div>
              <div className="text-center font-bold">{words.title}</div>
              {line("No.", slip.number)}
              {line("Date", date)}
              {slip.bill_number && line("Bill no.", slip.bill_number)}
              {slip.party_name && line(words.party, slip.party_name)}
              {slip.party_phone && line("Phone", slip.party_phone)}
              {slip.expected_date && line("Needed by", fmtDate(slip.expected_date))}
              {slip.deliver_to && line("Deliver to", slip.deliver_to)}
              {slip.vehicle_number && line("Vehicle no.", slip.vehicle_number)}
              {slip.driver_name && line("Driver", slip.driver_name)}
              {slip.driver_phone && line("Driver phone", slip.driver_phone)}
              <div className="border-t border-gray-300" />
              {slip.lines.map((l, i) => (
                <div key={i} className="flex justify-between gap-3">
                  <span className="min-w-0 break-words">{l.name}</span>
                  <span className="shrink-0 text-right tabular-nums">
                    {slipQty(l.quantity)}{l.unit ? ` ${l.unit}` : ""}
                    {withPrices && <> × {formatMoney(l.price, cur)} = {formatMoney(l.total, cur)}</>}
                  </span>
                </div>
              ))}
              <div className="border-t border-gray-300" />
              {line("Items", `${slip.lines.length} · Qty ${slipQty(slip.lines.reduce((a, l) => a + l.quantity, 0))}`)}
              {withPrices && <div className="flex justify-between gap-3 font-bold text-sm"><span>Total</span><span>{formatMoney(slip.total, cur)}</span></div>}
              {slip.notes && <div>Note: {slip.notes}</div>}
            </div>
          </>
        )}
        <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
          {slip?.kind === "delivery" && slip.driver_phone && (
            <Button variant="outline" onClick={() => send(slip.driver_phone, "driver")} className="border-gray-300 bg-white text-gray-900 hover:bg-gray-100">
              <MessageCircle className="size-4 mr-2" /> WhatsApp driver
            </Button>
          )}
          {/* Always offered: a missing number says so, rather than the button just not being there. */}
          {slip && (slip.party_phone || slip.party_name) && (
            <Button variant="outline" onClick={() => send(slip.party_phone, kind === "purchase" ? "supplier" : "customer")} className="border-gray-300 bg-white text-gray-900 hover:bg-gray-100">
              <MessageCircle className="size-4 mr-2" /> WhatsApp {kind === "purchase" ? "supplier" : "customer"}
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
