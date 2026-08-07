import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useShop } from "@/contexts/ShopContext";
import { format } from "date-fns";
import type { LabOrderDto } from "@/lib/labTypes";

/**
 * Printable A4 lab report. Print styling hides the app chrome so a normal
 * (non-thermal) printer produces a clean patient report.
 */
export function LabReportDialog({ order, onClose }: { order: LabOrderDto | null; onClose: () => void }) {
  const { currentShop } = useShop();
  if (!order) return null;

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto print:max-w-none print:shadow-none print:border-0">
        <div id="lab-report" className="bg-white text-black p-6 print:p-0">
          <div className="text-center border-b pb-3 mb-4">
            <div className="text-xl font-bold">{currentShop?.name ?? "Laboratory"}</div>
            {currentShop?.address && <div className="text-xs">{currentShop.address}</div>}
            {currentShop?.phone && <div className="text-xs">Ph: {currentShop.phone}</div>}
            <div className="mt-2 text-sm font-semibold uppercase tracking-wide">Laboratory Report</div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-4">
            <div><span className="text-gray-600">Patient:</span> <b>{order.patient_name || "—"}</b></div>
            <div><span className="text-gray-600">Token:</span> <b>{order.token_number}</b></div>
            <div><span className="text-gray-600">Age / Sex:</span> {[order.patient_age, order.patient_gender].filter(Boolean).join(" / ") || "—"}</div>
            <div><span className="text-gray-600">Test:</span> <b>{order.test_name}</b></div>
            <div><span className="text-gray-600">Phone:</span> {order.patient_phone || "—"}</div>
            <div><span className="text-gray-600">Date:</span> {format(new Date(order.completed_at ?? order.created_at), "PPp")}</div>
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-y bg-gray-50">
                <th className="text-left py-2 px-2">Test / Factor</th>
                <th className="text-left py-2 px-2 w-28">Result</th>
                <th className="text-left py-2 px-2 w-20">Unit</th>
                <th className="text-left py-2 px-2 w-32">Normal range</th>
              </tr>
            </thead>
            <tbody>
              {order.results.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-1.5 px-2">{r.name}</td>
                  <td className="py-1.5 px-2 font-semibold">{r.value || "—"}</td>
                  <td className="py-1.5 px-2">{r.unit || ""}</td>
                  <td className="py-1.5 px-2 text-gray-600">{r.normal_range || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {order.notes && (
            <div className="mt-4 text-sm">
              <div className="font-semibold">Notes</div>
              <div className="whitespace-pre-wrap">{order.notes}</div>
            </div>
          )}

          <div className="mt-10 flex justify-between text-xs text-gray-600">
            <div>Printed {format(new Date(), "PPp")}</div>
            <div className="text-center">
              <div className="border-t border-black w-40 pt-1">Authorised signature</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 print:hidden">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}>
            <Printer className="size-4 mr-1" /> Print report
          </Button>
        </div>
      </DialogContent>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #lab-report, #lab-report * { visibility: visible; }
          #lab-report { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </Dialog>
  );
}
