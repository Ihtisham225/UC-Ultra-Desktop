import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useShop } from "@/contexts/ShopContext";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { printCss } from "@/lib/urdu-print";
import type { LedgerResult } from "@/lib/handicraftTypes";

const ID = "statement-print";

/**
 * The register on A4 — the sheet in image 1 rather than the Urdu slip book, so
 * this one stays left-to-right English: opening balance, every goods line, job
 * bill and payment, and the balance running down the right-hand edge.
 *
 * It prints whatever the register is currently showing, so filtering to one
 * party gives that party their statement.
 */
export function PartyStatementPrintDialog({
  open,
  onClose,
  ledger,
  partyName,
  from,
  to,
}: {
  open: boolean;
  onClose: () => void;
  ledger: LedgerResult;
  /** "All parties" when the register isn't filtered to one. */
  partyName: string;
  from: string;
  to: string;
}) {
  const { currentShop } = useShop();
  const formatMoney = useFormatMoney();
  const currency = currentShop?.currency ?? "PKR";

  const period =
    from && to ? `${from} to ${to}` : from ? `from ${from}` : to ? `up to ${to}` : "all dates";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-5xl max-h-[92vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible print:shadow-none print:border-0">
        <div id={ID} className="bg-white text-black p-6 print:p-0">
          <div className="text-center border-b-2 border-black pb-2 mb-3">
            <div className="text-2xl font-bold">{currentShop?.name ?? ""}</div>
            <div className="text-xs">
              {[currentShop?.address, currentShop?.phone].filter(Boolean).join(" · ")}
            </div>
            <div className="mt-1 text-base font-bold">Account statement</div>
          </div>

          <div className="flex justify-between text-sm mb-2">
            <div><b>Party:</b> {partyName}</div>
            <div><b>Period:</b> {period}</div>
          </div>

          <table className="w-full border-collapse" style={{ border: "1px solid #000", fontSize: "11px" }}>
            <thead>
              <tr>
                <th className="border border-black p-1 w-8">SR</th>
                <th className="border border-black p-1">Date</th>
                <th className="border border-black p-1 text-start">Name</th>
                <th className="border border-black p-1">City</th>
                <th className="border border-black p-1">Bilty</th>
                <th className="border border-black p-1">Colour</th>
                <th className="border border-black p-1">Act</th>
                <th className="border border-black p-1">Bags</th>
                <th className="border border-black p-1">Pound</th>
                <th className="border border-black p-1">Rate</th>
                <th className="border border-black p-1">Amount</th>
                <th className="border border-black p-1">Received</th>
                <th className="border border-black p-1">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black p-1" />
                <td className="border border-black p-1 text-start" colSpan={9}>
                  <b>Opening balance</b> <span dir="rtl">سابقہ رقم</span>
                </td>
                <td className="border border-black p-1" />
                <td className="border border-black p-1" />
                <td className="border border-black p-1 text-end font-bold">
                  {formatMoney(ledger.opening, currency)}
                </td>
              </tr>

              {ledger.rows.map((r, i) => (
                <tr key={`${r.kind}-${r.id}-${r.itemId ?? i}`}>
                  <td className="border border-black p-1 text-center">{i + 1}</td>
                  <td className="border border-black p-1 whitespace-nowrap">{r.date}</td>
                  <td className="border border-black p-1">{r.supplier_name}</td>
                  {r.kind === "purchase" ? (
                    <>
                      <td className="border border-black p-1">{r.city ?? ""}</td>
                      <td className="border border-black p-1">{r.bilty_number ?? ""}</td>
                      <td className="border border-black p-1">{r.colour ?? ""}</td>
                      <td className="border border-black p-1">{r.act ?? ""}</td>
                      <td className="border border-black p-1 text-end">{r.bags || ""}</td>
                      <td className="border border-black p-1 text-end">{r.pounds || ""}</td>
                      <td className="border border-black p-1 text-end">{r.rate || ""}</td>
                    </>
                  ) : (
                    <td className="border border-black p-1" colSpan={7}>
                      {[r.label, r.method, r.reference, r.note].filter(Boolean).join(" · ")}
                    </td>
                  )}
                  <td className="border border-black p-1 text-end">
                    {r.debit ? formatMoney(r.debit, currency) : ""}
                  </td>
                  <td className="border border-black p-1 text-end">
                    {r.credit ? formatMoney(r.credit, currency) : ""}
                  </td>
                  <td className="border border-black p-1 text-end font-medium">
                    {formatMoney(r.balance, currency)}
                  </td>
                </tr>
              ))}

              <tr className="font-bold">
                <td className="border border-black p-1 text-start" colSpan={10}>Total</td>
                <td className="border border-black p-1 text-end">{formatMoney(ledger.debit_total, currency)}</td>
                <td className="border border-black p-1 text-end">{formatMoney(ledger.credit_total, currency)}</td>
                <td className="border border-black p-1 text-end">{formatMoney(ledger.closing, currency)}</td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-between items-end mt-6 text-sm">
            <div>
              <div className="text-xs text-gray-600">
                Purchases {formatMoney(ledger.purchase_total, currency)} · Job work{" "}
                {formatMoney(ledger.job_work_total, currency)} · Paid{" "}
                {formatMoney(ledger.credit_total, currency)}
              </div>
              <div className="mt-6">Signature: ____________________</div>
            </div>
            <div className="border-2 border-black px-4 py-2 text-end">
              <div className="text-xs">Balance</div>
              <div className="text-lg font-bold">{formatMoney(ledger.closing, currency)}</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 print:hidden">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}>
            <Printer className="size-4 mr-1" /> Print statement
          </Button>
        </div>
      </DialogContent>

      <style dangerouslySetInnerHTML={{ __html: printCss(ID) }} />
    </Dialog>
  );
}
