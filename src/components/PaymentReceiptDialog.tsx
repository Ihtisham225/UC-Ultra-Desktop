"use client";

import { useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { MessageCircle, Printer, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { buildWaReminderUrl } from "@/lib/debt-reminder";
import { printHtmlPage } from "@/components/ReturnReceiptDialog";
import {
  balanceAfterLine,
  buildPaymentReceiptHtml,
  buildPaymentReceiptMessage,
  paymentSlipWords,
  receiptNo,
  type PaymentReceiptDto,
  type PaymentSlipShop,
} from "@/lib/payment-receipt";
import { matchPosShortcut } from "@/lib/pos-shortcuts";

/**
 * The receipt for a khata payment — opened straight after the payment is
 * recorded, and again from the payment history for a reprint. Print and
 * WhatsApp work like the sale and return slips (Ctrl/Cmd+P, Alt+W).
 * Copied verbatim into the desktop.
 */
export function PaymentReceiptDialog({
  receipt,
  shop,
  onClose,
}: {
  receipt: PaymentReceiptDto | null;
  shop: PaymentSlipShop | null;
  onClose: () => void;
}) {
  const date = receipt ? format(new Date(receipt.created_at), "dd/MM/yyyy h:mm a") : "";
  const cur = shop?.currency ?? "PKR";
  const words = receipt ? paymentSlipWords(receipt) : null;
  const after = receipt ? balanceAfterLine(receipt.balance_after) : null;

  const print = () => {
    if (receipt && shop) printHtmlPage(buildPaymentReceiptHtml(receipt, shop, formatMoney, date));
  };
  const sendWhatsApp = () => {
    if (!receipt || !shop) return;
    if (!receipt.phone) return toast.error("No phone number on this account");
    const url = buildWaReminderUrl(receipt.phone, buildPaymentReceiptMessage(receipt, shop, formatMoney, date));
    if (!url) return toast.error("That phone number doesn't look like a WhatsApp number");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    if (!receipt) return;
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

  const line = (label: string, value: string, strong = false) => (
    <div className={"flex justify-between gap-3" + (strong ? " font-bold text-sm" : "")}>
      <span>{label}</span>
      <span className="tabular-nums text-right">{value}</span>
    </div>
  );

  return (
    <Dialog open={!!receipt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-enter-chain="off" className="sm:max-w-md bg-white text-black">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-black">
            <ReceiptText className="size-5" /> Receipt {receipt ? receiptNo(receipt) : ""}
          </DialogTitle>
        </DialogHeader>
        {receipt && words && after && (
          <div className="font-mono text-xs border border-gray-200 rounded-md p-3 space-y-1.5">
            <div className="text-center font-bold text-sm">{shop?.name}</div>
            <div className="text-center">{words.title}</div>
            {line("Receipt no.", receiptNo(receipt))}
            {line("Date", date)}
            {line(words.party, receipt.person_name)}
            {receipt.phone && line("Phone", receipt.phone)}
            <div className="border-t border-gray-300" />
            {line("Previous balance", formatMoney(receipt.balance_before, cur))}
            {line(receipt.direction === "i_owe" ? "Paid" : "Received", formatMoney(receipt.amount, cur), true)}
            {receipt.discount > 0 && line("Discount", formatMoney(receipt.discount, cur))}
            {receipt.method && line("Via", receipt.method)}
            <div className="border border-gray-400 rounded px-2 py-1">
              {line(after.label, formatMoney(after.amount, cur), true)}
            </div>
            {receipt.notes && <div>Note: {receipt.notes}</div>}
            {!receipt.receipt_number && (
              <div className="text-[11px] text-amber-700">
                Numbered once this till syncs — print again then for the final number.
              </div>
            )}
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          {receipt?.phone && (
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
