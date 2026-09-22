import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { BadgeCheck, Ban, FileCheck2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AccountPicker } from "@/components/AccountPicker";
import { useConfirm } from "@/components/ConfirmDialog";
import { Pagination } from "@/components/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { formatMoney } from "@/lib/format";
import { daysUntil, dueLabel } from "@/lib/cheques";
import type { ChequeDto } from "@/lib/cheques";

type Status = "pending" | "cleared" | "bounced" | "all";
// One loose shape: the terminal compiles without strict mode, where a
// `{ok:true}|{ok:false}` union doesn't narrow on `ok`.
type Result = { ok: boolean; error?: string };

/**
 * Post-dated cheques against the khata. A cheque was already taken off the
 * person's balance when it was recorded (Ledger → Record payment → Paid by
 * cheque); here it is either CLEARED — its money reaches the chosen account —
 * or BOUNCED, which puts the amount back on their khata.
 *
 * The data calls are passed in so the web (server actions) and the terminal
 * (RPC) share this screen.
 */
export function ChequesScreen({
  currency, reminderDays, canManage, list, clear, bounce,
}: {
  currency: string;
  reminderDays: number;
  canManage: boolean;
  list: (status: Status) => Promise<ChequeDto[]>;
  clear: (id: string, accountId: string | null) => Promise<Result>;
  bounce: (id: string) => Promise<Result>;
}) {
  const [status, setStatus] = useState<Status>("pending");
  const [rows, setRows] = useState<ChequeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState<ChequeDto | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await list(status)); } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't load cheques"); }
    setLoading(false);
  }, [list, status]);
  useEffect(() => { void load(); }, [load]);

  const { page, pageSize, setPage, visible, totalItems } = usePagination(rows, { key: "cheques", resetDeps: [status] });

  const pending = useMemo(() => rows.filter((r) => r.status === "pending"), [rows]);
  const dueSoon = pending.filter((r) => daysUntil(r.cheque_date) <= reminderDays);
  const pendingTotal = pending.reduce((a, r) => a + r.amount, 0);

  const doClear = async () => {
    if (!clearing) return;
    setBusy(true);
    const res = await clear(clearing.id, accountId);
    setBusy(false);
    if (!res.ok) return toast.error(res.error ?? "Couldn't clear the cheque");
    toast.success(`Cheque ${clearing.cheque_number} cleared`);
    setClearing(null);
    await load();
  };

  const doBounce = async (c: ChequeDto) => {
    const ok = await confirm({
      title: `Cheque ${c.cheque_number} bounced?`,
      description: `${formatMoney(c.amount, currency)} goes back on ${c.person_name}'s khata.`,
      confirmLabel: "Mark bounced",
      variant: "destructive",
    });
    if (!ok) return;
    const res = await bounce(c.id);
    if (!res.ok) return toast.error(res.error ?? "Couldn't mark it bounced");
    toast.success(`Put ${formatMoney(c.amount, currency)} back on ${c.person_name}'s khata`);
    await load();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileCheck2 className="size-6 text-primary" /> Cheques
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Record a cheque from the Ledger (Record payment → Paid by cheque). Mark it cleared once the bank pays it, or bounced to put the amount back on the khata.
        </p>
      </header>

      {status === "pending" && (
        <div className="grid grid-cols-2 gap-3 max-w-lg">
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Pending</div>
            <div className="text-xl font-bold tabular-nums">{formatMoney(pendingTotal, currency)}</div>
            <div className="text-xs text-muted-foreground">{pending.length} cheque{pending.length === 1 ? "" : "s"}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Due in {reminderDays} days</div>
            <div className={`text-xl font-bold tabular-nums ${dueSoon.length ? "text-warning" : ""}`}>{dueSoon.length}</div>
          </Card>
        </div>
      )}

      <Tabs value={status} onValueChange={(v) => setStatus(v as Status)}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="cleared">Cleared</TabsTrigger>
          <TabsTrigger value="bounced">Bounced</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-start p-3">Cheque #</th>
                <th className="text-start p-3">From / to</th>
                <th className="text-start p-3">Bank</th>
                <th className="text-start p-3">Cheque date</th>
                <th className="text-end p-3">Amount</th>
                <th className="text-start p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No cheques here.</td></tr>
              ) : visible.map((c) => {
                const days = daysUntil(c.cheque_date);
                const soon = c.status === "pending" && days <= reminderDays;
                return (
                  <tr key={c.id} className="border-t">
                    <td className="p-3 font-mono">{c.cheque_number}</td>
                    <td className="p-3">
                      <div className="font-medium">{c.person_name}</div>
                      <div className="text-xs text-muted-foreground">{c.direction === "received" ? "Received from" : "Given to"}</div>
                    </td>
                    <td className="p-3 text-muted-foreground">{c.bank_name ?? "—"}</td>
                    <td className="p-3 whitespace-nowrap">
                      <div>{format(new Date(`${c.cheque_date}T00:00:00`), "dd MMM yyyy")}</div>
                      {c.status === "pending" && (
                        <div className={`text-xs ${days < 0 ? "text-destructive" : soon ? "text-warning" : "text-muted-foreground"}`}>{dueLabel(days)}</div>
                      )}
                    </td>
                    <td className="p-3 text-end tabular-nums font-medium">{formatMoney(c.amount, currency)}</td>
                    <td className="p-3">
                      {c.status === "pending" && <Badge variant="outline">Pending</Badge>}
                      {c.status === "cleared" && (
                        <Badge variant="outline" className="text-success border-success/40">Cleared{c.account_name ? ` · ${c.account_name}` : ""}</Badge>
                      )}
                      {c.status === "bounced" && <Badge variant="outline" className="text-destructive border-destructive/40">Bounced</Badge>}
                    </td>
                    <td className="p-3 text-end whitespace-nowrap">
                      {canManage && c.status === "pending" && (
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => { setAccountId(null); setClearing(c); }}>
                            <BadgeCheck className="size-4 mr-1" /> Cleared
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => void doBounce(c)}>
                            <Ban className="size-4 mr-1" /> Bounced
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} />
      </Card>

      <Dialog open={!!clearing} onOpenChange={(o) => !o && setClearing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cheque {clearing?.cheque_number} cleared</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {clearing && `${formatMoney(clearing.amount, currency)} ${clearing.direction === "received" ? "goes into" : "comes out of"} the account you choose. ${clearing.person_name}'s khata already shows it as paid.`}
          </p>
          <AccountPicker value={accountId} onChange={setAccountId} label={clearing?.direction === "issued" ? "Paid from" : "Deposited into"} allowNone={false} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearing(null)}>Cancel</Button>
            <Button onClick={() => void doClear()} disabled={busy}>{busy ? "Saving…" : "Mark cleared"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
