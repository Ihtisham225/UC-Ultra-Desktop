import { format } from "date-fns";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { personLedgerLog, type LedgerLogPayment, type PersonLogDebt } from "@/lib/ledger-log";

/** A yyyy-mm-dd is a calendar day; build it in local time, not as UTC midnight. */
const day = (v: string) => new Date(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1, Number(v.slice(8, 10)));

type LogPayment = LedgerLogPayment & { debt_id: string };

/**
 * One person's whole account — every bill and every payment across all their
 * khata rows — oldest first, with the balance after each. Read-only. Fed from
 * the terminal's local store, so it reads with no connection. A copy of the web
 * app's `LedgerEntriesTable` — keep them in step.
 */
export function LedgerEntriesTable({
  debts,
  payments,
  error,
  currency,
}: {
  debts: PersonLogDebt[];
  payments: LogPayment[] | null;
  error?: string | null;
  currency: string;
}) {
  const money = (n: number) => formatMoney(n, currency);
  const log = payments ? personLedgerLog(debts, payments) : null;

  return (
    <section className="space-y-3 border-t pt-4">
      <h3 className="text-sm font-semibold">Account history</h3>
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
              {log.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Nothing recorded yet.</TableCell>
                </TableRow>
              ) : (
                log.rows.map((r) => {
                  const charge = r.kind !== "payment";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{format(day(r.date), "d MMM yyyy")}</TableCell>
                      <TableCell>
                        <div className={charge ? "text-destructive" : "text-success"}>
                          {r.kind === "bill" ? (r.label ?? "Bill") : r.kind === "increase" ? "Added to the khata" : "Payment"}
                          {r.discount > 0 && <span className="text-warning"> · {money(r.discount)} written off</span>}
                        </div>
                        {r.notes && <div className="text-xs text-muted-foreground break-words">{r.notes}</div>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.account_name ?? "—"}</TableCell>
                      <TableCell className={`text-end tabular-nums ${charge ? "text-destructive" : "text-success"}`}>
                        {charge ? "+" : "−"}{money(r.amount)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{money(r.balance_after)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-medium">
                  Billed {money(log.totals.billed)}
                  {log.totals.added > 0 && <> · added {money(log.totals.added)}</>}
                  {" · "}paid {money(log.totals.paid)}
                  {log.totals.discount > 0 && <> · written off {money(log.totals.discount)}</>}
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
