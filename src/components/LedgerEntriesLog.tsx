import { format } from "date-fns";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { ledgerLog, type LedgerLogPayment } from "@/lib/ledger-log";

/** A yyyy-mm-dd is a calendar day; build it in local time, not as UTC midnight. */
const day = (v: string) => new Date(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1, Number(v.slice(8, 10)));

/**
 * Every entry against one khata row, oldest first, with the balance after each.
 * Read-only. Fed from the terminal's local store, so it reads with no
 * connection. A copy of the web app's `LedgerEntriesTable` — keep them in step.
 */
export function LedgerEntriesTable({
  payments,
  error,
  debtAmount,
  currency,
}: {
  payments: LedgerLogPayment[] | null;
  error?: string | null;
  debtAmount: number;
  currency: string;
}) {
  const money = (n: number) => formatMoney(n, currency);
  const log = payments ? ledgerLog(debtAmount, payments) : null;

  return (
    <section className="space-y-3 border-t pt-4">
      <h3 className="text-sm font-semibold">Payment history</h3>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !log ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-end">Amount</TableHead>
                <TableHead className="text-end">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/40">
                <TableCell className="text-muted-foreground">—</TableCell>
                <TableCell className="font-medium" colSpan={3}>Opening amount</TableCell>
                <TableCell className="text-end tabular-nums font-medium">{money(log.opening)}</TableCell>
              </TableRow>
              {log.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    No payments recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                log.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{format(day(r.date), "d MMM yyyy")}</TableCell>
                    <TableCell>
                      <div className={r.kind === "increase" ? "text-destructive" : "text-success"}>
                        {r.kind === "increase" ? "Added to the khata" : "Payment"}
                        {r.discount > 0 && (
                          <span className="text-warning"> · {money(r.discount)} written off</span>
                        )}
                      </div>
                      {r.notes && <div className="text-xs text-muted-foreground break-words">{r.notes}</div>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.account_name ?? "—"}</TableCell>
                    <TableCell className={`text-end tabular-nums ${r.kind === "increase" ? "text-destructive" : "text-success"}`}>
                      {r.kind === "increase" ? "+" : "−"}{money(r.amount)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{money(r.balance_after)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-medium">
                  {log.rows.length} {log.rows.length === 1 ? "entry" : "entries"} · paid {money(log.totals.paid)}
                  {log.totals.discount > 0 && <> · written off {money(log.totals.discount)}</>}
                  {log.totals.added > 0 && <> · added {money(log.totals.added)}</>}
                </TableCell>
                <TableCell className="text-end font-medium">Remaining</TableCell>
                <TableCell className="text-end tabular-nums font-semibold">{money(log.closing)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </section>
  );
}
