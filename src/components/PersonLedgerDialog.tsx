/**
 * One person's ledger, read like a khata book (and like daily-cup's customer
 * page): who they are and what they owe at the top, three totals, then every
 * bill and payment on its own line with the balance after it.
 *
 * Whatever the account is made of underneath — one khata row per unpaid bill,
 * rows facing the other way, a payment spread over several bills — is folded
 * into ONE running balance by lib/person-ledger.
 *
 * ⚠️ COPIED VERBATIM to the desktop app; each app feeds it its own rows.
 */
import { useMemo, useState } from "react";
import { HandCoins, Phone, Printer, ReceiptText, Search, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { formatMoney } from "@/lib/format";
import { fmtDate } from "@/lib/date-format";
import {
  balanceWords,
  buildLedgerStatement,
  openingBefore,
  type StatementDebt,
  type StatementKind,
  type StatementPayment,
  type StatementSide,
} from "@/lib/person-ledger";

type KindFilter = "all" | "bills" | "payments";

const KIND_BADGE: Record<StatementKind, { label: string; cls: string }> = {
  bill: { label: "Bill", cls: "border-sky-500/40 text-sky-700 dark:text-sky-300" },
  debt: { label: "Debt", cls: "border-amber-500/40 text-amber-700 dark:text-amber-300" },
  payment: { label: "Payment", cls: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" },
  credit: { label: "Credit", cls: "border-violet-500/40 text-violet-700 dark:text-violet-300" },
};

export function PersonLedgerDialog({
  open,
  onClose,
  name,
  phone,
  currency,
  side,
  debts,
  payments,
  loading = false,
  onRecordPayment,
  onPrint,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  phone: string | null;
  currency: string;
  /** Write the statement from this side (the list the person was opened from). */
  side?: StatementSide;
  /** Every khata row of this person, both directions. */
  debts: StatementDebt[];
  /** Every entry against those rows. */
  payments: StatementPayment[];
  loading?: boolean;
  /** Opens the shop's own payment form for this person. */
  onRecordPayment?: () => void;
  /** Prints the A4 statement. */
  onPrint?: () => void;
}) {
  const [range, setRange] = useState({ from: "", to: "" });
  const [kind, setKind] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");

  const st = useMemo(() => buildLedgerStatement(debts, payments, side), [debts, payments, side]);
  const m = (n: number) => formatMoney(n, currency);

  const opening = range.from ? openingBefore(st.lines, range.from) : 0;
  const inRange = st.lines.filter((l) => (!range.from || l.date >= range.from) && (!range.to || l.date <= range.to));
  const closing = inRange.length ? inRange[inRange.length - 1].balance : opening;
  const q = search.trim().toLowerCase();
  const shown = [...inRange].reverse().filter((l) => {
    if (kind === "bills" && l.charge <= 0) return false;
    if (kind === "payments" && l.paid <= 0) return false;
    if (!q) return true;
    return `${l.title} ${l.detail} ${l.date}`.toLowerCase().includes(q);
  });

  const owesWord = balanceWords(st.balance, st.side);
  const chargeHead = st.side === "payable" ? "Bought / owed" : "Charged";
  const paidHead = st.side === "payable" ? "Paid to them" : "Received";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-enter-chain="off" className="sm:max-w-5xl max-h-[calc(100dvh-2rem)] flex flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="sr-only">Ledger · {name}</DialogTitle>
        </DialogHeader>

        {/* Who, and where the account stands. */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4 -mt-4">
          <div className="min-w-0">
            <div className="text-xl font-bold tracking-tight truncate">{name}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-1.5">
              {phone ? (<><Phone className="size-3.5" /> {phone}</>) : "No phone number"}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{owesWord}</div>
              <div className={"text-2xl font-bold tabular-nums whitespace-nowrap " + (st.balance > 0.005 ? "text-destructive" : st.balance < -0.005 ? "text-success" : "")}>
                {m(Math.abs(st.balance))}
              </div>
            </div>
            <div className="grid gap-2">
              {onRecordPayment && (
                <Button size="sm" onClick={onRecordPayment}>
                  <HandCoins className="size-4 mr-1" /> Record payment
                </Button>
              )}
              {onPrint && (
                <Button size="sm" variant="outline" onClick={onPrint}>
                  <Printer className="size-4 mr-1" /> Print
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5"><ReceiptText className="size-3.5" /> {chargeHead}</div>
            <div className="mt-1 font-semibold tabular-nums">{m(st.charged)}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5"><HandCoins className="size-3.5" /> {paidHead}</div>
            <div className="mt-1 font-semibold tabular-nums">{m(st.paid)}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Wallet className="size-3.5" /> Balance</div>
            <div className={"mt-1 font-semibold tabular-nums " + (st.balance > 0.005 ? "text-destructive" : "")}>{m(st.balance)}</div>
          </Card>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Newest first, with the balance after each line.
            {(range.from || range.to) && (
              <> Opening <span className="font-medium text-foreground tabular-nums">{m(opening)}</span> → closing{" "}
                <span className="font-medium text-foreground tabular-nums">{m(closing)}</span>.</>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
            <Select value={kind} onValueChange={(v) => setKind(v as KindFilter)}>
              <SelectTrigger className="h-9 w-36" aria-label="Show"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entries</SelectItem>
                <SelectItem value="bills">Bills &amp; debts</SelectItem>
                <SelectItem value="payments">Payments</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input className="h-9 w-40 pl-8" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-md border">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {st.lines.length === 0 ? "Nothing on this ledger yet." : "No entries match."}
            </p>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead className="text-right">{chargeHead}</TableHead>
                  <TableHead className="text-right">{paidHead}</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((l, i) => (
                  <TableRow key={l.key}>
                    <TableCell className="text-muted-foreground tabular-nums">{shown.length - i}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(l.date)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <Badge variant="outline" className={"text-[10px] " + KIND_BADGE[l.kind].cls}>{KIND_BADGE[l.kind].label}</Badge>
                        <span className="font-medium">{l.title}</span>
                      </div>
                      {l.detail && <div className="text-xs text-muted-foreground mt-0.5">{l.detail}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">{l.charge > 0 ? m(l.charge) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap text-success">{l.paid > 0 ? m(l.paid) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap font-medium">{m(l.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
