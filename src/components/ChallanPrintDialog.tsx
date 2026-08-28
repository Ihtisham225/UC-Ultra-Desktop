import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useShop } from "@/contexts/ShopContext";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { UR, URDU_FONT_STACK, printCss } from "@/lib/urdu-print";
import { CHALLAN_KIND } from "@/lib/handicraft";
import type { ChallanDto, JobProcessDto } from "@/lib/handicraftTypes";

const ID = "challan-print";

/**
 * The sent challan on A4, laid out like the shop's carbon book: right-to-left,
 * Urdu headings, one tick column per process, and the counted-by / sent-via /
 * total-bundles footer they fill in by hand.
 */
export function ChallanPrintDialog({
  challan,
  processes,
  onClose,
}: {
  challan: ChallanDto | null;
  processes: JobProcessDto[];
  onClose: () => void;
}) {
  const { currentShop } = useShop();
  const formatMoney = useFormatMoney();
  if (!challan) return null;
  const currency = currentShop?.currency ?? "PKR";
  const making = challan.kind === "making";
  const copy = CHALLAN_KIND[challan.kind];

  // Only the work this challan actually asks for gets a column — printing all
  // eight of a shop's processes would squash the detail column to nothing.
  // A making challan carries no process ticks — it carries weights instead.
  const used = processes.filter((p) => challan.items.some((it) => it.process_ids.includes(p.id)));
  const columns = making ? [] : used.length > 0 ? used : processes.slice(0, 4);
  const anyWeight = challan.items.some((it) => it.per_piece_weight);
  const anyRate = challan.items.some((it) => it.rate);

  return (
    <Dialog open={!!challan} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible print:shadow-none print:border-0">
        <div id={ID} dir="rtl" className="bg-white text-black p-6 print:p-0" style={{ fontFamily: URDU_FONT_STACK }}>
          <div className="text-center border-b-2 border-black pb-2 mb-3">
            <div className="text-2xl font-bold">{currentShop?.name ?? ""}</div>
            <div className="text-xs">
              {[currentShop?.address, currentShop?.phone].filter(Boolean).join(" · ")}
            </div>
            <div className="mt-1 text-base font-bold">{copy.urdu}</div>
            <div className="text-[10px] tracking-wide" dir="ltr">{copy.english}</div>
          </div>

          <div className="flex justify-between text-sm mb-2">
            <div>
              <b>{UR.billTo}:</b> {challan.supplier_name}
            </div>
            <div className="flex gap-4">
              <span><b>{UR.billNumber}:</b> {challan.book_number || challan.number}</span>
              <span><b>{UR.date}:</b> {challan.date}</span>
            </div>
          </div>

          <table className="w-full text-sm border-collapse" style={{ border: "1px solid #000" }}>
            <thead>
              <tr>
                <th className="border border-black p-1 w-10">{UR.serial}</th>
                <th className="border border-black p-1 text-start">{UR.detail}</th>
                <th className="border border-black p-1 w-16">{UR.quantity}</th>
                {making && anyWeight && (
                  <>
                    <th className="border border-black p-1 w-20">{UR.perPieceWeight}</th>
                    <th className="border border-black p-1 w-20">{UR.totalWeight}</th>
                  </>
                )}
                {making && anyRate && (
                  <>
                    <th className="border border-black p-1 w-20">{UR.rate}</th>
                    <th className="border border-black p-1 w-24">{UR.amount}</th>
                  </>
                )}
                {columns.map((p) => (
                  <th key={p.id} className="border border-black p-1 w-14">
                    <div>{p.name_local || p.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {challan.items.map((it, i) => (
                <tr key={it.id}>
                  <td className="border border-black p-1 text-center">{i + 1}</td>
                  <td className="border border-black p-1">{it.description}</td>
                  <td className="border border-black p-1 text-center font-medium">{it.quantity}</td>
                  {making && anyWeight && (
                    <>
                      <td className="border border-black p-1 text-center">{it.per_piece_weight ?? ""}</td>
                      <td className="border border-black p-1 text-center">
                        {it.per_piece_weight ? Number((it.quantity * it.per_piece_weight).toFixed(3)) : ""}
                      </td>
                    </>
                  )}
                  {making && anyRate && (
                    <>
                      <td className="border border-black p-1 text-center" dir="ltr">{it.rate ?? ""}</td>
                      <td className="border border-black p-1 text-center" dir="ltr">
                        {it.rate ? formatMoney(it.quantity * it.rate, currency) : ""}
                      </td>
                    </>
                  )}
                  {columns.map((p) => (
                    <td key={p.id} className="border border-black p-1 text-center">
                      {it.process_ids.includes(p.id) ? "✓" : "✗"}
                    </td>
                  ))}
                </tr>
              ))}
              {/* Blank rows so the slip looks like the printed book and leaves
                  room to add a line by hand at the counter. */}
              {Array.from({ length: Math.max(0, 10 - challan.items.length) }).map((_, i) => (
                <tr key={`blank-${i}`}>
                  <td className="border border-black p-1 text-center text-gray-400">
                    {challan.items.length + i + 1}
                  </td>
                  <td className="border border-black p-1">&nbsp;</td>
                  <td className="border border-black p-1" />
                  {making && anyWeight && (
                    <>
                      <td className="border border-black p-1" />
                      <td className="border border-black p-1" />
                    </>
                  )}
                  {making && anyRate && (
                    <>
                      <td className="border border-black p-1" />
                      <td className="border border-black p-1" />
                    </>
                  )}
                  {columns.map((p) => <td key={p.id} className="border border-black p-1" />)}
                </tr>
              ))}
              <tr className="font-bold">
                <td className="border border-black p-1" colSpan={2}>{UR.total}</td>
                <td className="border border-black p-1 text-center">{challan.total_qty}</td>
                {making && anyWeight && (
                  <>
                    <td className="border border-black p-1" />
                    <td className="border border-black p-1 text-center">
                      {Number(
                        challan.items
                          .reduce((sum, it) => sum + it.quantity * (it.per_piece_weight ?? 0), 0)
                          .toFixed(3),
                      ) || ""}
                    </td>
                  </>
                )}
                {making && anyRate && (
                  <>
                    <td className="border border-black p-1" />
                    <td className="border border-black p-1 text-center" dir="ltr">
                      {formatMoney(
                        challan.items.reduce((sum, it) => sum + it.quantity * (it.rate ?? 0), 0),
                        currency,
                      )}
                    </td>
                  </>
                )}
                {columns.map((p) => <td key={p.id} className="border border-black p-1" />)}
              </tr>
            </tbody>
          </table>

          <table className="w-full text-sm border-collapse mt-3" style={{ border: "1px solid #000" }}>
            <tbody>
              <tr>
                <td className="border border-black p-1.5 w-1/3">
                  <b>{UR.countedBy}:</b> {challan.counted_by || ""}
                </td>
                <td className="border border-black p-1.5 w-1/3">
                  <b>{UR.totalBundles}:</b> {challan.total_bundles ?? ""}
                </td>
                <td className="border border-black p-1.5 w-1/3">
                  <b>{UR.sentVia}:</b> {challan.sent_via || ""}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-1.5" colSpan={2}>
                  <b>{UR.note}:</b> {challan.notes || ""}
                </td>
                <td className="border border-black p-1.5 pt-6">
                  <b>{UR.signature}:</b>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2 print:hidden">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}>
            <Printer className="size-4 mr-1" /> Print challan
          </Button>
        </div>
      </DialogContent>

      <style dangerouslySetInnerHTML={{ __html: printCss(ID) }} />
    </Dialog>
  );
}
