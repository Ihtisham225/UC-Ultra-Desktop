import { useCallback, useEffect, useMemo, useState } from "react";
import { rpc } from "@/lib/apiClient";
import { useShop } from "@/contexts/ShopContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirm } from "@/components/ConfirmDialog";
import { PiggyBank, Plus, Pencil, Trash2, ArrowDownToLine, ArrowUpFromLine, History } from "lucide-react";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { usePageMeta } from "@/hooks/usePageMeta";
import { format } from "date-fns";
import { toast } from "sonner";

export interface InvestorDto {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  commission_percent: number;
  balance: number;
  is_active: boolean;
  total_invested: number;
  total_withdrawn: number;
  total_earned: number;
  stock_value: number;
  created_at: string;
}

interface InvestorTxRow {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
}

const TX_LABELS: Record<string, string> = {
  deposit: "Money added",
  withdrawal: "Money taken out",
  purchase: "Stock purchased",
  purchase_reversal: "Purchase reversed",
  sale_credit: "Stock sold",
  sale_credit_reversal: "Sale reversed",
  adjustment: "Adjustment",
};

interface EditingInvestor {
  id?: string;
  name: string;
  phone: string;
  notes: string;
  commission_percent: string;
  initial_amount: string;
}

const blank: EditingInvestor = { name: "", phone: "", notes: "", commission_percent: "", initial_amount: "" };

export default function Investors() {
  usePageMeta({ title: "Investors — UCU", description: "Track investor capital, funded stock and earnings.", path: "/investors" });
  const { currentShop, role } = useShop();
  const formatMoney = useFormatMoney();
  const cur = currentShop?.currency ?? "USD";
  const canDelete = role === "owner";

  const [rows, setRows] = useState<InvestorDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditingInvestor | null>(null);
  const [money, setMoney] = useState<{ investor: InvestorDto; kind: "deposit" | "withdrawal" } | null>(null);
  const [amount, setAmount] = useState("");
  const [moneyNotes, setMoneyNotes] = useState("");
  const [ledger, setLedger] = useState<InvestorDto | null>(null);
  const [txRows, setTxRows] = useState<InvestorTxRow[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const load = useCallback(async () => {
    if (!currentShop) return;
    setLoading(true);
    try {
      setRows(await rpc<InvestorDto[]>("listInvestorsAction"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load investors");
    } finally {
      setLoading(false);
    }
  }, [currentShop]);

  useEffect(() => { load(); }, [load]);

  const openLedger = async (inv: InvestorDto) => {
    setLedger(inv);
    setTxLoading(true);
    try {
      const { rows } = await rpc<{ rows: InvestorTxRow[]; totalCount: number }>(
        "listInvestorTransactionsAction", inv.id, 1, 100,
      );
      setTxRows(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load transactions");
    } finally {
      setTxLoading(false);
    }
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error("Name is required");
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("saveInvestorAction", {
        id: editing.id,
        name: editing.name.trim(),
        phone: editing.phone.trim() || null,
        notes: editing.notes.trim() || null,
        commission_percent: editing.commission_percent === "" ? 0 : parseFloat(editing.commission_percent) || 0,
        initial_amount: editing.id ? null : parseFloat(editing.initial_amount) || 0,
      });
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
    toast.success(editing.id ? "Investor updated" : "Investor added");
    setEditing(null);
    load();
  };

  const submitMoney = async () => {
    if (!money) return;
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return toast.error("Enter an amount");
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; balance?: number; error?: string }>("investorTxAction", {
        investor_id: money.investor.id,
        type: money.kind,
        amount: amt,
        notes: moneyNotes.trim() || null,
      });
      if (!res.ok) return toast.error(res.error ?? "Failed");
      toast.success(
        money.kind === "deposit"
          ? `Added ${formatMoney(amt, cur)} — balance ${formatMoney(res.balance ?? 0, cur)}`
          : `Withdrew ${formatMoney(amt, cur)} — balance ${formatMoney(res.balance ?? 0, cur)}`
      );
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
    setMoney(null);
    setAmount("");
    setMoneyNotes("");
    load();
  };

  const remove = async (inv: InvestorDto) => {
    const ok = await confirm({
      title: "Delete investor",
      description: `Delete ${inv.name}? Their transaction history will be removed too.`,
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("deleteInvestorAction", inv.id);
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    }
    toast.success("Deleted");
    load();
  };

  const totals = useMemo(() => ({
    balance: rows.reduce((a, r) => a + r.balance, 0),
    stock: rows.reduce((a, r) => a + r.stock_value, 0),
    earned: rows.reduce((a, r) => a + r.total_earned, 0),
  }), [rows]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PiggyBank className="size-6 text-primary" /> Investors
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Capital that funds purchases — sales of that stock pay the investor back.
          </p>
        </div>
        <Button onClick={() => setEditing({ ...blank })}>
          <Plus className="size-4 me-1" /> Add investor
        </Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="px-5 py-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Investors</div>
          <div className="text-xl font-bold tabular-nums">{rows.length}</div>
        </Card>
        <Card className="px-5 py-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Available capital</div>
          <div className="text-xl font-bold tabular-nums">{formatMoney(totals.balance, cur)}</div>
        </Card>
        <Card className="px-5 py-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">In stock (at cost)</div>
          <div className="text-xl font-bold tabular-nums">{formatMoney(totals.stock, cur)}</div>
        </Card>
        <Card className="px-5 py-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Earned from sales</div>
          <div className="text-xl font-bold tabular-nums">{formatMoney(totals.earned, cur)}</div>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-end">Commission</TableHead>
              <TableHead className="text-end">Invested</TableHead>
              <TableHead className="text-end">In stock</TableHead>
              <TableHead className="text-end">Earned</TableHead>
              <TableHead className="text-end">Balance</TableHead>
              <TableHead className="w-40"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                  No investors yet. Add one, then pick them in the purchase form to fund stock with their capital.
                </TableCell>
              </TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-muted-foreground">{r.phone ?? "—"}</TableCell>
                <TableCell className="text-end tabular-nums">{r.commission_percent > 0 ? `${r.commission_percent}%` : "—"}</TableCell>
                <TableCell className="text-end tabular-nums">{formatMoney(r.total_invested, cur)}</TableCell>
                <TableCell className="text-end tabular-nums">{formatMoney(r.stock_value, cur)}</TableCell>
                <TableCell className="text-end tabular-nums">{formatMoney(r.total_earned, cur)}</TableCell>
                <TableCell className="text-end tabular-nums font-semibold">{formatMoney(r.balance, cur)}</TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="icon" title="Add money" onClick={() => { setMoney({ investor: r, kind: "deposit" }); setAmount(""); setMoneyNotes(""); }}>
                      <ArrowDownToLine className="size-4 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Take money out" onClick={() => { setMoney({ investor: r, kind: "withdrawal" }); setAmount(""); setMoneyNotes(""); }}>
                      <ArrowUpFromLine className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="History" onClick={() => openLedger(r)}>
                      <History className="size-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" title="Edit"
                      onClick={() => setEditing({
                        id: r.id,
                        name: r.name,
                        phone: r.phone ?? "",
                        notes: r.notes ?? "",
                        commission_percent: r.commission_percent ? String(r.commission_percent) : "",
                        initial_amount: "",
                      })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    {canDelete && (
                      <Button variant="ghost" size="icon" title="Delete" onClick={() => remove(r)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Add / edit investor */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit investor" : "Add investor"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Shop commission %</Label>
                  <Input
                    type="number" min="0" max="100" step="0.5" placeholder="0"
                    value={editing.commission_percent}
                    onChange={(e) => setEditing({ ...editing, commission_percent: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground">Kept by the shop when their stock sells.</p>
                </div>
                {!editing.id && (
                  <div className="space-y-1.5">
                    <Label>Opening investment</Label>
                    <Input
                      type="number" min="0" step="0.01" placeholder="0.00"
                      value={editing.initial_amount}
                      onChange={(e) => setEditing({ ...editing, initial_amount: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={2} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deposit / withdraw */}
      <Dialog open={!!money} onOpenChange={(o) => !o && setMoney(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {money?.kind === "deposit" ? "Add money" : "Take money out"} — {money?.investor.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Current balance: <span className="font-semibold text-foreground tabular-nums">{formatMoney(money?.investor.balance ?? 0, cur)}</span>
            </div>
            <div className="space-y-1.5">
              <Label>Amount *</Label>
              <Input type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={moneyNotes} onChange={(e) => setMoneyNotes(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoney(null)}>Cancel</Button>
            <Button onClick={submitMoney} disabled={busy}>
              {busy ? "Saving…" : money?.kind === "deposit" ? "Add money" : "Withdraw"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ledger */}
      <Dialog open={!!ledger} onOpenChange={(o) => !o && setLedger(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{ledger?.name} — history</DialogTitle></DialogHeader>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>What happened</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-end">Amount</TableHead>
                  <TableHead className="text-end">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                ) : txRows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No transactions yet.</TableCell></TableRow>
                ) : txRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="tabular-nums whitespace-nowrap">{format(new Date(r.created_at), "MMM d, HH:mm")}</TableCell>
                    <TableCell>{TX_LABELS[r.type] ?? r.type}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground text-sm">{r.notes ?? "—"}</TableCell>
                    <TableCell className={`text-end tabular-nums font-medium ${r.amount < 0 ? "text-destructive" : "text-primary"}`}>
                      {r.amount < 0 ? "−" : "+"}{formatMoney(Math.abs(r.amount), cur)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{formatMoney(r.balance_after, cur)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
