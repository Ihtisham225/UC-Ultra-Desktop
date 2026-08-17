import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, Landmark, Banknote, Plus, ArrowLeftRight, History, Pencil, Archive, ArchiveRestore, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useShop } from "@/contexts/ShopContext";
import { useFormatMoney } from "@/hooks/useFormatMoney";

export interface AccountRow {
  id: string;
  name: string;
  type: "cash" | "bank" | "wallet";
  is_archived: boolean;
  opening_balance: number;
  balance: number;
  txn_count: number;
}

export interface AccountEntry {
  id: string;
  date: string;
  amount: number;
  kind: string;
  note: string | null;
  transfer_name: string | null;
  running: number;
}

/**
 * Everything the two apps share for Accounts. The host passes its own data
 * layer — server actions on web, rpc on desktop — so the screen itself stays
 * identical in both.
 */
export interface AccountsApi {
  list: (includeArchived: boolean) => Promise<AccountRow[]>;
  detail: (id: string) => Promise<{ account: AccountRow; entries: AccountEntry[] } | null>;
  create: (input: unknown) => Promise<{ ok: boolean; error?: string }>;
  update: (id: string, input: unknown) => Promise<{ ok: boolean; error?: string }>;
  setArchived: (id: string, archived: boolean) => Promise<{ ok: boolean; error?: string }>;
  adjust: (input: unknown) => Promise<{ ok: boolean; error?: string }>;
  transfer: (input: unknown) => Promise<{ ok: boolean; error?: string }>;
}

const TYPE_ICON = { cash: Banknote, bank: Landmark, wallet: Wallet } as const;
const TYPE_LABEL = { cash: "Cash", bank: "Bank", wallet: "Wallet" } as const;
const today = () => new Date().toISOString().slice(0, 10);

const KIND_LABEL: Record<string, string> = {
  deposit: "Deposit", withdrawal: "Withdrawal", transfer: "Transfer",
  adjustment: "Adjustment", sale: "Sale", purchase: "Purchase", expense: "Expense",
};

export function AccountsScreen({ api, canEdit }: { api: AccountsApi; canEdit: boolean }) {
  const { currentShop } = useShop();
  const formatMoney = useFormatMoney();
  const cur = currentShop?.currency ?? "USD";

  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", type: "bank", opening_balance: "" });

  const [moveFor, setMoveFor] = useState<{ account: AccountRow; kind: "deposit" | "withdrawal" } | null>(null);
  const [moveForm, setMoveForm] = useState({ amount: "", date: today(), note: "" });

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({ from: "", to: "", amount: "", date: today(), note: "" });

  const [historyFor, setHistoryFor] = useState<AccountRow | null>(null);
  const [entries, setEntries] = useState<AccountEntry[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.list(showArchived));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load accounts");
    }
    setLoading(false);
  }, [api, showArchived]);

  useEffect(() => { load(); }, [load]);

  const active = useMemo(() => rows.filter((r) => !r.is_archived), [rows]);
  const total = useMemo(() => active.reduce((a, r) => a + r.balance, 0), [active]);

  const openCreate = () => {
    setForm({ name: "", type: "bank", opening_balance: "" });
    setEditing(null);
    setCreating(true);
  };
  const openEdit = (r: AccountRow) => {
    setForm({ name: r.name, type: r.type, opening_balance: String(r.opening_balance) });
    setEditing(r);
    setCreating(true);
  };

  const saveAccount = async () => {
    const payload = {
      name: form.name.trim(),
      type: form.type,
      opening_balance: parseFloat(form.opening_balance) || 0,
    };
    if (!payload.name) return toast.error("Enter a name");
    setBusy(true);
    const res = editing ? await api.update(editing.id, payload) : await api.create(payload);
    setBusy(false);
    if (!res.ok) return toast.error(res.error ?? "Failed");
    toast.success(editing ? "Account updated" : "Account added");
    setCreating(false);
    load();
  };

  const saveMove = async () => {
    if (!moveFor) return;
    const amount = parseFloat(moveForm.amount);
    if (!amount || amount <= 0) return toast.error("Amount must be greater than 0");
    setBusy(true);
    const res = await api.adjust({
      account_id: moveFor.account.id, kind: moveFor.kind, amount,
      date: moveForm.date, note: moveForm.note.trim() || null,
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error ?? "Failed");
    toast.success(moveFor.kind === "deposit" ? "Money added" : "Money taken out");
    setMoveFor(null);
    load();
  };

  const saveTransfer = async () => {
    const amount = parseFloat(transferForm.amount);
    if (!transferForm.from || !transferForm.to) return toast.error("Pick both accounts");
    if (transferForm.from === transferForm.to) return toast.error("Pick two different accounts");
    if (!amount || amount <= 0) return toast.error("Amount must be greater than 0");
    setBusy(true);
    const res = await api.transfer({
      from_account_id: transferForm.from, to_account_id: transferForm.to,
      amount, date: transferForm.date, note: transferForm.note.trim() || null,
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error ?? "Failed");
    toast.success("Transferred");
    setTransferOpen(false);
    setTransferForm({ from: "", to: "", amount: "", date: today(), note: "" });
    load();
  };

  const openHistory = async (r: AccountRow) => {
    setHistoryFor(r);
    setEntries(null);
    try {
      const d = await api.detail(r.id);
      setEntries(d?.entries ?? []);
    } catch {
      setEntries([]);
    }
  };

  const toggleArchive = async (r: AccountRow) => {
    setBusy(true);
    const res = await api.setArchived(r.id, !r.is_archived);
    setBusy(false);
    if (!res.ok) return toast.error(res.error ?? "Failed");
    toast.success(r.is_archived ? "Account restored" : "Account archived");
    load();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wallet className="size-7 text-primary" /> Accounts
          </h1>
          <p className="text-muted-foreground mt-1">
            Where your money sits — the cash drawer, bank accounts and wallets.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load}><RefreshCw className="size-4 me-1" /> Refresh</Button>
          {canEdit && (
            <>
              <Button variant="outline" onClick={() => setTransferOpen(true)} disabled={active.length < 2}>
                <ArrowLeftRight className="size-4 me-1" /> Transfer
              </Button>
              <Button onClick={openCreate}><Plus className="size-4 me-1" /> New account</Button>
            </>
          )}
        </div>
      </header>

      <Card className="p-5">
        <div className="text-sm text-muted-foreground">Total across active accounts</div>
        <div className="text-3xl font-bold tabular-nums mt-1">{formatMoney(total, cur)}</div>
      </Card>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{active.length} active</span>
        <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "Hide archived" : "Show archived"}
        </Button>
      </div>

      {loading ? (
        <Card className="p-10 text-center text-muted-foreground">Loading…</Card>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          No accounts yet. Cash is added automatically — press Refresh, or add a bank or wallet.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => {
            const Icon = TYPE_ICON[r.type] ?? Wallet;
            return (
              <Card key={r.id} className={`p-4 ${r.is_archived ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-primary shrink-0" />
                      <span className="font-semibold truncate">{r.name}</span>
                      <Badge variant="secondary" className="shrink-0">{TYPE_LABEL[r.type]}</Badge>
                      {r.is_archived && <Badge variant="outline" className="shrink-0">Archived</Badge>}
                    </div>
                    <div className="text-2xl font-bold tabular-nums mt-2">{formatMoney(r.balance, cur)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {r.txn_count} {r.txn_count === 1 ? "entry" : "entries"}
                      {r.opening_balance !== 0 && <> · opened at {formatMoney(r.opening_balance, cur)}</>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <Button size="sm" variant="outline" onClick={() => openHistory(r)}>
                    <History className="size-3.5 me-1" /> History
                  </Button>
                  {canEdit && !r.is_archived && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => { setMoveFor({ account: r, kind: "deposit" }); setMoveForm({ amount: "", date: today(), note: "" }); }}>
                        Add money
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setMoveFor({ account: r, kind: "withdrawal" }); setMoveForm({ amount: "", date: today(), note: "" }); }}>
                        Take out
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="size-3.5" /></Button>
                    </>
                  )}
                  {canEdit && (
                    <Button size="sm" variant="ghost" onClick={() => toggleArchive(r)} disabled={busy}>
                      {r.is_archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New / edit account */}
      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit account" : "New account"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. EasyPaisa, Meezan Bank" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="wallet">Wallet (EasyPaisa, JazzCash…)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Opening balance</Label>
              <Input
                type="number" inputMode="decimal" step="0.01" placeholder="0.00"
                value={form.opening_balance}
                onChange={(e) => setForm({ ...form, opening_balance: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                What the account already holds today. Sales and transfers are added on top.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)} disabled={busy}>Cancel</Button>
            <Button onClick={saveAccount} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deposit / withdrawal */}
      <Dialog open={!!moveFor} onOpenChange={(o) => !o && setMoveFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {moveFor?.kind === "deposit" ? "Add money to" : "Take money out of"} {moveFor?.account.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" inputMode="decimal" step="0.01" autoFocus
                value={moveForm.amount} onChange={(e) => setMoveForm({ ...moveForm, amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={moveForm.date} onChange={(e) => setMoveForm({ ...moveForm, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input value={moveForm.note} onChange={(e) => setMoveForm({ ...moveForm, note: e.target.value })} placeholder="Why the money moved" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveFor(null)} disabled={busy}>Cancel</Button>
            <Button onClick={saveMove} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer */}
      <Dialog open={transferOpen} onOpenChange={(o) => !o && setTransferOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Transfer between accounts</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>From</Label>
                <Select value={transferForm.from} onValueChange={(v) => setTransferForm({ ...transferForm, from: v })}>
                  <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
                  <SelectContent>
                    {active.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <Select value={transferForm.to} onValueChange={(v) => setTransferForm({ ...transferForm, to: v })}>
                  <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
                  <SelectContent>
                    {active.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" inputMode="decimal" step="0.01"
                value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={transferForm.date} onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input value={transferForm.note} onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={saveTransfer} disabled={busy}>{busy ? "Saving…" : "Transfer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History */}
      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{historyFor?.name} — history</DialogTitle></DialogHeader>
          {entries === null ? (
            <p className="py-8 text-center text-muted-foreground">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nothing has moved through this account yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead className="text-end">Amount</TableHead>
                  <TableHead className="text-end">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm whitespace-nowrap">{format(new Date(e.date + "T00:00:00"), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-sm">
                      {KIND_LABEL[e.kind] ?? e.kind}
                      {e.transfer_name && <span className="text-muted-foreground"> · {e.transfer_name}</span>}
                      {e.note && <div className="text-xs text-muted-foreground">{e.note}</div>}
                    </TableCell>
                    <TableCell className={`text-end tabular-nums ${e.amount < 0 ? "text-destructive" : "text-emerald-600"}`}>
                      {e.amount < 0 ? "−" : "+"}{formatMoney(Math.abs(e.amount), cur)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{formatMoney(e.running, cur)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
