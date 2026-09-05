import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useShop } from "@/contexts/ShopContext";
import { UR, URDU_FONT_STACK, printCss } from "@/lib/urdu-print";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import type { CustomerChallanDto } from "@/lib/craftCustomerTypes";

const ID = "customer-challan-print";

/**
 * The customer's copy on A4, laid out like the shop's carbon book — RTL with
 * Urdu headings, the same as the job-work challan the factory gets, so the
 * whole book reads one way.
 *
 * There is no item table: a customer challan is one amount off the bill pad,
 * which is how the shop writes it.
 */
export function CustomerChallanPrintDialog({
  challan,
  onClose,
}: {
  challan: CustomerChallanDto | null;
  onClose: () => void;
}) {
  const { currentShop } = useShop();
  const formatMoney = useFormatMoney();
  const cur = currentShop?.currency ?? "PKR";
  if (!challan) return null;

  const row = (label: string, en: string, value: string) => (
    <div className="flex justify-between border-b border-black/30 py-1.5">
      <span className="font-semibold">
        {label} <span className="text-[10px] opacity-70">({en})</span>
      </span>
      <span className="tabular-nums">{value || "—"}</span>
    </div>
  );

  return (
    <Dialog open={!!challan} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible print:shadow-none print:border-0">
        <div
          id={ID}
          dir="rtl"
          className="bg-white text-black p-6 print:p-0"
          style={{ fontFamily: URDU_FONT_STACK }}
        >
          <div className="text-center border-b-2 border-black pb-2 mb-3">
            <div className="text-2xl font-bold">{currentShop?.name ?? ""}</div>
            {currentShop?.address && <div className="text-xs">{currentShop.address}</div>}
            {currentShop?.phone && <div className="text-xs">{currentShop.phone}</div>}
          </div>

          <div className="flex justify-between text-sm mb-3">
            <span className="font-bold">
              {UR.billNumber}: {challan.number}
            </span>
            <span>
              {UR.date}: {challan.date}
            </span>
          </div>

          <div className="text-sm">
            {row(UR.billTo, "Customer", challan.customer_name)}
            {row(UR.billNumber, "Bill no", challan.bill_no ?? "")}
            {row(UR.sentVia, "Bilty no", challan.bilty_no ?? "")}
            {row(UR.date, "Due date", challan.due_date ?? "")}
            <div className="flex justify-between border-b-2 border-black py-2 text-base font-bold">
              <span>
                {UR.totalAmount} <span className="text-[10px] opacity-70">(Total)</span>
              </span>
              <span className="tabular-nums">{formatMoney(challan.amount, cur)}</span>
            </div>
            {challan.notes && (
              <div className="py-2 text-xs">
                <span className="font-semibold">{UR.note}: </span>
                {challan.notes}
              </div>
            )}
          </div>

          <div className="flex justify-between mt-12 text-xs">
            <div className="w-40 border-t border-black pt-1 text-center">{UR.signature}</div>
            <div className="w-40 border-t border-black pt-1 text-center">{UR.received}</div>
          </div>
        </div>

        <div className="flex justify-end gap-2 print:hidden">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="size-4 mr-2" /> Print
          </Button>
        </div>
      </DialogContent>
      <style dangerouslySetInnerHTML={{ __html: printCss(ID) }} />
    </Dialog>
  );
}
