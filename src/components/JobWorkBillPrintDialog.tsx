import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useShop } from "@/contexts/ShopContext";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { UR, URDU_FONT_STACK, printCss } from "@/lib/urdu-print";
import type { ReceiptDto } from "@/lib/handicraftTypes";

const ID = "job-bill-print";

/**
 * The bill written when goods come back: what returned, what was short or
 * spoiled, and a money column per process. Same right-to-left Urdu layout as
 * the sent challan so the two slips file together.
 */
export function JobWorkBillPrintDialog({
  receipt,
  onClose,
}: {
  receipt: ReceiptDto | null;
  onClose: () => void;
}) {
  const { currentShop } = useShop();
  const formatMoney = useFormatMoney();
  if (!receipt) return null;

  const currency = currentShop?.currency ?? "PKR";
  // A column per process actually charged on this bill.
  const names = [...new Set(receipt.items.flatMap((it) => it.charges.map((c) => c.process_name)))];
  const anyShort = receipt.items.some((it) => it.short_qty > 0 || it.damaged_qty > 0);
  const amountFor = (itemIndex: number, name: string) =>
    receipt.items[itemIndex].charges
      .filter((c) => c.process_name === name)
      .reduce((s, c) => s + c.amount, 0);

  return (
    <Dialog open={!!receipt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible print:shadow-none print:border-0">
        <div id={ID} dir="rtl" className="bg-white text-black p-6 print:p-0" style={{ fontFamily: URDU_FONT_STACK }}>
          <div className="text-center border-b-2 border-black pb-2 mb-3">
            <div className="text-2xl font-bold">{currentShop?.name ?? ""}</div>
            <div className="text-xs">
              {[currentShop?.address, currentShop?.phone].filter(Boolean).join(" · ")}
            </div>
            <div className="mt-1 text-base font-bold">{UR.goodsIn}</div>
            <div className="text-[10px] tracking-wide" dir="ltr">GOODS RECEIVED &amp; WORK BILL</div>
          </div>

          <div className="flex justify-between text-sm mb-2">
            <div><b>{UR.billTo}:</b> {receipt.supplier_name}</div>
            <div className="flex gap-4">
              <span><b>{UR.billNumber}:</b> {receipt.book_number || receipt.number}</span>
              <span dir="ltr"><b>challan</b> #{receipt.challan_number}</span>
              <span><b>{UR.date}:</b> {receipt.date}</span>
            </div>
          </div>

          <table className="w-full text-sm border-collapse" style={{ border: "1px solid #000" }}>
            <thead>
              <tr>
                <th className="border border-black p-1 w-10">{UR.serial}</th>
                {/* Held wide on purpose: with five money columns beside it the
                    description otherwise wraps to one word per line. */}
                <th className="border border-black p-1 text-start" style={{ width: "28%" }}>{UR.detail}</th>
                <th className="border border-black p-1 w-14">{UR.received}</th>
                {anyShort && <th className="border border-black p-1 w-12">{UR.short}</th>}
                {anyShort && <th className="border border-black p-1 w-12">{UR.damaged}</th>}
                {names.map((n) => (
                  <th key={n} className="border border-black p-1 w-20">{n}</th>
                ))}
                <th className="border border-black p-1 w-24">{UR.total}</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((it, i) => (
                <tr key={it.id}>
                  <td className="border border-black p-1 text-center">{i + 1}</td>
                  <td className="border border-black p-1">
                    <div>{it.description}</div>
                    {it.note && <div className="text-xs text-gray-600">{it.note}</div>}
                  </td>
                  <td className="border border-black p-1 text-center font-medium">{it.received_qty}</td>
                  {anyShort && <td className="border border-black p-1 text-center">{it.short_qty || ""}</td>}
                  {anyShort && <td className="border border-black p-1 text-center">{it.damaged_qty || ""}</td>}
                  {names.map((n) => {
                    const amount = amountFor(i, n);
                    return (
                      <td key={n} className="border border-black p-1 text-center" dir="ltr">
                        {amount ? formatMoney(amount, currency) : ""}
                      </td>
                    );
                  })}
                  <td className="border border-black p-1 text-center font-medium" dir="ltr">
                    {formatMoney(it.line_total, currency)}
                  </td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="border border-black p-1" colSpan={2}>{UR.total}</td>
                <td className="border border-black p-1 text-center">
                  {receipt.items.reduce((s, it) => s + it.received_qty, 0)}
                </td>
                {anyShort && (
                  <td className="border border-black p-1 text-center">
                    {receipt.items.reduce((s, it) => s + it.short_qty, 0) || ""}
                  </td>
                )}
                {anyShort && (
                  <td className="border border-black p-1 text-center">
                    {receipt.items.reduce((s, it) => s + it.damaged_qty, 0) || ""}
                  </td>
                )}
                {names.map((n) => (
                  <td key={n} className="border border-black p-1 text-center" dir="ltr">
                    {formatMoney(
                      receipt.items.reduce((s, _it, i) => s + amountFor(i, n), 0),
                      currency,
                    )}
                  </td>
                ))}
                <td className="border border-black p-1 text-center" dir="ltr">
                  {formatMoney(receipt.charges_total, currency)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-between items-start mt-3 gap-4">
            <div className="text-sm pt-6 flex-1">
              <b>{UR.signature}:</b> ____________________
              {receipt.received_via && (
                <div className="mt-2"><b>{UR.sentVia}:</b> {receipt.received_via}</div>
              )}
              {receipt.notes && <div className="mt-1"><b>{UR.note}:</b> {receipt.notes}</div>}
            </div>
            <table className="text-sm border-collapse w-64" style={{ border: "1px solid #000" }}>
              <tbody>
                <tr>
                  <td className="border border-black p-1.5">{UR.totalAmount}</td>
                  <td className="border border-black p-1.5 text-end" dir="ltr">
                    {formatMoney(receipt.charges_total, currency)}
                  </td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5">{UR.deduction}</td>
                  <td className="border border-black p-1.5 text-end" dir="ltr">
                    {receipt.deduction ? formatMoney(receipt.deduction, currency) : "—"}
                  </td>
                </tr>
                <tr className="font-bold">
                  <td className="border border-black p-1.5">{UR.remainingAmount}</td>
                  <td className="border border-black p-1.5 text-end" dir="ltr">
                    {formatMoney(receipt.total, currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-2 print:hidden">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}>
            <Printer className="size-4 mr-1" /> Print bill
          </Button>
        </div>
      </DialogContent>

      <style dangerouslySetInnerHTML={{ __html: printCss(ID) }} />
    </Dialog>
  );
}
