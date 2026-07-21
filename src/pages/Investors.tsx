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
import { TrendingUp, Plus, Pencil, Trash2, ArrowDownToLine, ArrowUpFromLine, History, Users, HandCoins } from "lucide-react";
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

interface PoolMemberDto {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  capital: number;
  share_percent: number;
  total_deposited: number;
  total_withdrawn: number;
  total_profit: number;
  created_at: string;
}

interface PoolDistributionDto {
  id: string;
  period_start: string;
  gross_profit: number;
  expenses_deducted: number;
  net_profit: number;
  notes: string | null;
  created_at: string;
}

interface PoolStateDto {
  id: string;
  cash: number;
  stock_value: number;
  total_capital: number;
  accrued_profit: number;
  suggested_expenses: number;
  members: PoolMemberDto[];
  distributions: PoolDistributionDto[];
}

interface PoolMemberTxRow {
  id: string;
  type: string;
  amount: number;
  capital_after: number;
  notes: string | null;
  created_at: string;
}

interface ShopInvestorEarnings {
  commission_earned: number;
  pool_expenses_recovered: number;
  total: number;
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

const POOL_TX_LABELS: Record<string, string> = {
  deposit: "Money added",
  withdrawal: "Money taken out",
  profit_share: "Profit share",
  loss_share: "Loss share",
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
  const mode = currentShop?.investor_mode ?? "individual";
  const showPool = mode === "shared" || mode === "both";
  const showIndividual = mode === "individual" || mode === "both";
  const defaultCommission = currentShop?.investor_default_commission ?? 0;

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

  // Shop's own earnings from the investor arrangement
  const [earnings, setEarnings] = useState<ShopInvestorEarnings | null>(null);

  // Shared pool
  const [pool, setPool] = useState<PoolStateDto | null>(null);
  const [memberEditing, setMemberEditing] = useState<{ id?: string; name: string; phone: string; notes: string; initial_amount: string } | null>(null);
  const [memberMoney, setMemberMoney] = useState<{ member: PoolMemberDto; kind: "deposit" | "withdrawal" } | null>(null);
  const [memberLedger, setMemberLedger] = useState<PoolMemberDto | null>(null);
  const [memberTxRows, setMemberTxRows] = useState<PoolMemberTxRow[]>([]);
  const [memberTxLoading, setMemberTxLoading] = useState(false);
  const [distribute, setDistribute] = useState<{ expenses: string; notes: string } | null>(null);

  const load = useCallback(async () => {
    if (!currentShop) return;
    setLoading(true);
    try {
      const [list, poolState, shopEarnings] = await Promise.all([
        rpc<InvestorDto[]>("listInvestorsAction"),
        rpc<PoolStateDto | null>("getPoolAction"),
        rpc<ShopInvestorEarnings>("getShopInvestorEarningsAction"),
      ]);
      setRows(list);
      setPool(poolState);
      setEarnings(shopEarnings);
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

  // ── Shared pool handlers ──────────────────────────────────────────────────
  const saveMember = async () => {
    if (!memberEditing) return;
    if (!memberEditing.name.trim()) return toast.error("Name is required");
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("savePoolMemberAction", {
        id: memberEditing.id,
        name: memberEditing.name.trim(),
        phone: memberEditing.phone.trim() || null,
        notes: memberEditing.notes.trim() || null,
        initial_amount: memberEditing.id ? null : parseFloat(memberEditing.initial_amount) || 0,
      });
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
    toast.success(memberEditing.id ? "Member updated" : "Member added");
    setMemberEditing(null);
    load();
  };

  const submitMemberMoney = async () => {
    if (!memberMoney) return;
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return toast.error("Enter an amount");
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; capital?: number; settled?: boolean; error?: string }>("poolMemberTxAction", {
        member_id: memberMoney.member.id,
        type: memberMoney.kind,
        amount: amt,
        notes: moneyNotes.trim() || null,
      });
      if (!res.ok) return toast.error(res.error ?? "Failed");
      toast.success(
        (res.settled ? "Profits distributed first. " : "") +
          (memberMoney.kind === "deposit"
            ? `Added ${formatMoney(amt, cur)} — capital ${formatMoney(res.capital ?? 0, cur)}`
            : `Withdrew ${formatMoney(amt, cur)} — capital ${formatMoney(res.capital ?? 0, cur)}`)
      );
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
    setMemberMoney(null);
    setAmount("");
    setMoneyNotes("");
    load();
  };

  const openMemberLedger = async (m: PoolMemberDto) => {
    setMemberLedger(m);
    setMemberTxLoading(true);
    try {
      setMemberTxRows(await rpc<PoolMemberTxRow[]>("listPoolMemberTransactionsAction", m.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load transactions");
    } finally {
      setMemberTxLoading(false);
    }
  };

  const removeMember = async (m: PoolMemberDto) => {
    const ok = await confirm({
      title: "Remove member",
      description: `Remove ${m.name} from the pool? Their capital must already be 0.`,
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("deletePoolMemberAction", m.id);
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    }
    toast.success("Removed");
    load();
  };

  const submitDistribute = async () => {
    if (!distribute || !pool) return;
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; gross_profit?: number; expenses_deducted?: number; net_profit?: number; error?: string }>(
        "distributePoolAction",
        {
          expenses_deduction: distribute.expenses === "" ? null : Math.max(parseFloat(distribute.expenses) || 0, 0),
          notes: distribute.notes.trim() || null,
        },
      );
      if (!res.ok) return toast.error(res.error ?? "Failed");
      toast.success(
        `Distributed ${formatMoney(res.net_profit ?? 0, cur)} (profit ${formatMoney(res.gross_profit ?? 0, cur)} − expenses ${formatMoney(res.expenses_deducted ?? 0, cur)})`
      );
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
    setDistribute(null);
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
            <TrendingUp className="size-6 text-primary" /> Investors
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Capital that funds purchases — sales of that stock pay the investor back.
          </p>
        </div>
        {showIndividual && (
          <Button onClick={() => setEditing({ ...blank, commission_percent: defaultCommission ? String(defaultCommission) : "" })}>
            <Plus className="size-4 me-1" /> Add investor
          </Button>
        )}
      </header>

      {/* What the shop itself keeps from the investor arrangement */}
      {earnings && earnings.total > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <HandCoins className="size-4 text-primary" />
            <h2 className="font-semibold">Your shop's earnings from investors</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {showIndividual && (
              <div className="rounded-lg border px-4 py-2.5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Commission earned</div>
                <div className="text-lg font-bold tabular-nums">{formatMoney(earnings.commission_earned, cur)}</div>
                <div className="text-[11px] text-muted-foreground">Your cut of investors' stock sales</div>
              </div>
            )}
            {showPool && (
              <div className="rounded-lg border px-4 py-2.5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Expenses recovered from pool</div>
                <div className="text-lg font-bold tabular-nums">{formatMoney(earnings.pool_expenses_recovered, cur)}</div>
                <div className="text-[11px] text-muted-foreground">Pool's share of your shop expenses</div>
              </div>
            )}
            <div className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total the shop keeps</div>
              <div className="text-lg font-bold tabular-nums text-primary">{formatMoney(earnings.total, cur)}</div>
              <div className="text-[11px] text-muted-foreground">On top of your own sales profit (see Analytics)</div>
            </div>
          </div>
        </Card>
      )}

      {/* ── Shared pool ─────────────────────────────────────────────── */}
      {showPool && (
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Users className="size-4 text-primary" /> Shared pool
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Everyone's money in one pot — purchases draw from it, and profit is split by each member's share.
            </p>
          </div>
          {pool && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setMemberEditing({ name: "", phone: "", notes: "", initial_amount: "" })}>
                <Plus className="size-4 me-1" /> Add member
              </Button>
              <Button size="sm" onClick={() => setDistribute({ expenses: String(pool.suggested_expenses || ""), notes: "" })} disabled={role !== "owner"}>
                <HandCoins className="size-4 me-1" /> Distribute profits
              </Button>
            </div>
          )}
        </div>

        {!pool ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-muted-foreground">
              Pool not ready yet. Turn on "Shared pool" (or "Both") in Settings → Investors.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border px-4 py-2.5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total capital</div>
                <div className="text-lg font-bold tabular-nums">{formatMoney(pool.total_capital, cur)}</div>
              </div>
              <div className="rounded-lg border px-4 py-2.5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Cash available</div>
                <div className="text-lg font-bold tabular-nums">{formatMoney(pool.cash, cur)}</div>
              </div>
              <div className="rounded-lg border px-4 py-2.5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">In stock (at cost)</div>
                <div className="text-lg font-bold tabular-nums">{formatMoney(pool.stock_value, cur)}</div>
              </div>
              <div className="rounded-lg border px-4 py-2.5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Profit to distribute</div>
                <div className={`text-lg font-bold tabular-nums ${pool.accrued_profit < 0 ? "text-destructive" : "text-primary"}`}>
                  {formatMoney(pool.accrued_profit, cur)}
                </div>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-end">Share</TableHead>
                    <TableHead className="text-end">Put in</TableHead>
                    <TableHead className="text-end">Taken out</TableHead>
                    <TableHead className="text-end">Profit earned</TableHead>
                    <TableHead className="text-end">Capital</TableHead>
                    <TableHead className="w-40"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pool.members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No members yet — add each person and how much they put in.
                      </TableCell>
                    </TableRow>
                  ) : pool.members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-end tabular-nums">{m.share_percent}%</TableCell>
                      <TableCell className="text-end tabular-nums">{formatMoney(m.total_deposited, cur)}</TableCell>
                      <TableCell className="text-end tabular-nums">{formatMoney(m.total_withdrawn, cur)}</TableCell>
                      <TableCell className={`text-end tabular-nums ${m.total_profit < 0 ? "text-destructive" : ""}`}>{formatMoney(m.total_profit, cur)}</TableCell>
                      <TableCell className="text-end tabular-nums font-semibold">{formatMoney(m.capital, cur)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button variant="ghost" size="icon" title="Add money" onClick={() => { setMemberMoney({ member: m, kind: "deposit" }); setAmount(""); setMoneyNotes(""); }}>
                            <ArrowDownToLine className="size-4 text-primary" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Take money out" onClick={() => { setMemberMoney({ member: m, kind: "withdrawal" }); setAmount(""); setMoneyNotes(""); }}>
                            <ArrowUpFromLine className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="History" onClick={() => openMemberLedger(m)}>
                            <History className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Edit" onClick={() => setMemberEditing({ id: m.id, name: m.name, phone: m.phone ?? "", notes: m.notes ?? "", initial_amount: "" })}>
                            <Pencil className="size-4" />
                          </Button>
                          {canDelete && (
                            <Button variant="ghost" size="icon" title="Remove" onClick={() => removeMember(m)}>
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {pool.distributions.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Past distributions</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-end">Profit</TableHead>
                        <TableHead className="text-end">Expenses</TableHead>
                        <TableHead className="text-end">Distributed</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pool.distributions.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="tabular-nums whitespace-nowrap">{format(new Date(d.created_at), "MMM d, yyyy HH:mm")}</TableCell>
                          <TableCell className="text-end tabular-nums">{formatMoney(d.gross_profit, cur)}</TableCell>
                          <TableCell className="text-end tabular-nums">{d.expenses_deducted ? `−${formatMoney(d.expenses_deducted, cur)}` : "—"}</TableCell>
                          <TableCell className={`text-end tabular-nums font-medium ${d.net_profit < 0 ? "text-destructive" : "text-primary"}`}>{formatMoney(d.net_profit, cur)}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">{d.notes ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
      )}

      {showIndividual && showPool && (
        <h2 className="font-semibold flex items-center gap-2 pt-2">
          <TrendingUp className="size-4 text-primary" /> Individual investors
        </h2>
      )}

      {showIndividual && (
      <>
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
      </>
      )}

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

      {/* Deposit / withdraw (individual) */}
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

      {/* Ledger (individual) */}
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

      {/* Pool: add / edit member */}
      <Dialog open={!!memberEditing} onOpenChange={(o) => !o && setMemberEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{memberEditing?.id ? "Edit member" : "Add pool member"}</DialogTitle></DialogHeader>
          {memberEditing && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={memberEditing.name} onChange={(e) => setMemberEditing({ ...memberEditing, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={memberEditing.phone} onChange={(e) => setMemberEditing({ ...memberEditing, phone: e.target.value })} />
                </div>
              </div>
              {!memberEditing.id && (
                <div className="space-y-1.5">
                  <Label>Opening contribution</Label>
                  <Input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={memberEditing.initial_amount}
                    onChange={(e) => setMemberEditing({ ...memberEditing, initial_amount: e.target.value })}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={2} value={memberEditing.notes} onChange={(e) => setMemberEditing({ ...memberEditing, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberEditing(null)}>Cancel</Button>
            <Button onClick={saveMember} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pool: member deposit / withdraw */}
      <Dialog open={!!memberMoney} onOpenChange={(o) => !o && setMemberMoney(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {memberMoney?.kind === "deposit" ? "Add money" : "Take money out"} — {memberMoney?.member.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Capital: <span className="font-semibold text-foreground tabular-nums">{formatMoney(memberMoney?.member.capital ?? 0, cur)}</span>
              {memberMoney?.kind === "withdrawal" && pool && (
                <> · Pool cash: <span className="font-semibold text-foreground tabular-nums">{formatMoney(pool.cash, cur)}</span></>
              )}
            </div>
            {pool && pool.accrued_profit !== 0 && (
              <p className="text-xs text-muted-foreground">
                Undistributed profit of {formatMoney(pool.accrued_profit, cur)} will be shared out first, so everyone's capital is up to date before this change.
              </p>
            )}
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
            <Button variant="outline" onClick={() => setMemberMoney(null)}>Cancel</Button>
            <Button onClick={submitMemberMoney} disabled={busy}>
              {busy ? "Saving…" : memberMoney?.kind === "deposit" ? "Add money" : "Withdraw"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pool: member history */}
      <Dialog open={!!memberLedger} onOpenChange={(o) => !o && setMemberLedger(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{memberLedger?.name} — history</DialogTitle></DialogHeader>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>What happened</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-end">Amount</TableHead>
                  <TableHead className="text-end">Capital</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberTxLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                ) : memberTxRows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No transactions yet.</TableCell></TableRow>
                ) : memberTxRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="tabular-nums whitespace-nowrap">{format(new Date(r.created_at), "MMM d, HH:mm")}</TableCell>
                    <TableCell>{POOL_TX_LABELS[r.type] ?? r.type}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground text-sm">{r.notes ?? "—"}</TableCell>
                    <TableCell className={`text-end tabular-nums font-medium ${r.amount < 0 ? "text-destructive" : "text-primary"}`}>
                      {r.amount < 0 ? "−" : "+"}{formatMoney(Math.abs(r.amount), cur)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{formatMoney(r.capital_after, cur)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pool: distribute profits */}
      <Dialog open={!!distribute} onOpenChange={(o) => !o && setDistribute(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Distribute profits</DialogTitle></DialogHeader>
          {distribute && pool && (
            <div className="space-y-4">
              <div className="rounded-lg border divide-y">
                <div className="flex justify-between px-4 py-2 text-sm">
                  <span className="text-muted-foreground">Profit since last distribution</span>
                  <span className="font-semibold tabular-nums">{formatMoney(pool.accrued_profit, cur)}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2 text-sm gap-3">
                  <span className="text-muted-foreground shrink-0">Shop expenses to deduct</span>
                  <Input
                    type="number" min="0" step="0.01" className="w-32 text-end"
                    value={distribute.expenses}
                    onChange={(e) => setDistribute({ ...distribute, expenses: e.target.value })}
                  />
                </div>
                <div className="flex justify-between px-4 py-2 text-sm">
                  <span className="text-muted-foreground">To distribute</span>
                  {(() => {
                    const net = pool.accrued_profit - (parseFloat(distribute.expenses) || 0);
                    return (
                      <span className={`font-bold tabular-nums ${net < 0 ? "text-destructive" : "text-primary"}`}>
                        {formatMoney(net, cur)}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                The expense amount is prefilled with the pool's share of shop expenses for this period (based on its share of sales) — adjust it if needed. Each member's share is added to their capital.
              </p>
              {pool.members.length > 0 && pool.total_capital > 0 && (
                <div className="text-xs space-y-1">
                  {pool.members.filter((m) => m.capital > 0).map((m) => {
                    const net = pool.accrued_profit - (parseFloat(distribute.expenses) || 0);
                    const share = (m.capital / pool.total_capital) * net;
                    return (
                      <div key={m.id} className="flex justify-between">
                        <span className="text-muted-foreground">{m.name} ({m.share_percent}%)</span>
                        <span className={`tabular-nums font-medium ${share < 0 ? "text-destructive" : ""}`}>{formatMoney(Math.round(share * 100) / 100, cur)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input value={distribute.notes} onChange={(e) => setDistribute({ ...distribute, notes: e.target.value })} placeholder="e.g. Weekly settlement" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDistribute(null)}>Cancel</Button>
            <Button onClick={submitDistribute} disabled={busy}>{busy ? "Distributing…" : "Distribute"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
