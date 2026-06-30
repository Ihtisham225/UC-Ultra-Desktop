import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useShop } from "@/contexts/ShopContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, Trash2, Wallet, Eye, TrendingUp, TrendingDown } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Pagination } from "@/components/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DetailsDialog } from "@/components/DetailsDialog";
import { PageTip } from "@/components/PageTip";

type Direction = "owed_to_me" | "i_owe";
type Status = "open" | "settled";

interface Debt {
  id: string;
  shop_id: string;
  created_by: string;
  direction: Direction;
  person_name: string;
  phone: string | null;
  amount: number;
  paid_amount: number;
  currency: string | null;
  due_date: string | null;
  status: Status;
  notes: string | null;
  settled_at: string | null;
  created_at: string;
  updated_at: string;
}

type EntryKind = "payment" | "increase";

interface DebtPayment {
  id: string;
  debt_id: string;
  shop_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  kind: EntryKind;
}

const empty = {
  direction: "owed_to_me" as Direction,
  person_name: "",
  phone: "",
  amount: "",
  due_date: "",
  notes: "",
};

const emptyPayment = {
  kind: "payment" as EntryKind,
  amount: "",
  payment_date: new Date().toISOString().slice(0, 10),
  notes: "",
};

const getRemainingAmount = (debt: Pick<Debt, "amount" | "paid_amount">) =>
  Math.max(Number(debt.amount) - Number(debt.paid_amount ?? 0), 0);

const getDisplayStatus = (debt: Pick<Debt, "status" | "amount" | "paid_amount">): Status =>
  getRemainingAmount(debt as Debt) <= 0 ? "settled" : debt.status;

export default function Debts() {
  const { currentShop } = useShop();
  const { user } = useAuth();
  const perms = usePermissions();
  const formatMoney = useFormatMoney();
  const canManage = perms.canManageExpenses; // owner/manager

  const [items, setItems] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "open" | "settled">("open");
  const [filter, setFilter] = useState<"all" | Direction>("all");
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ ...emptyPayment });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [confirmPaymentDeleteId, setConfirmPaymentDeleteId] = useState<string | null>(null);
  const [details, setDetails] = useState<Debt | null>(null);

  const cur = currentShop?.currency ?? "USD";

  const load = async () => {
    if (!currentShop) return [] as Debt[];
    setLoading(true);
    const { data, error } = await supabase
      .from("debts")
      .select("*")
      .eq("shop_id", currentShop.id)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return [] as Debt[];
    }
    const rows = (data ?? []) as Debt[];
    setItems(rows);
    return rows;
  };

  const loadPayments = async (debtId: string) => {
    setPaymentsLoading(true);
    const { data, error } = await supabase
      .from("debt_payments")
      .select("*")
      .eq("debt_id", debtId)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false });
    setPaymentsLoading(false);
    if (error) {
      toast.error(error.message);
      return [] as DebtPayment[];
    }
    const rows = (data ?? []) as DebtPayment[];
    setPayments(rows);
    return rows;
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShop?.id]);

  const filtered = useMemo(() => {
    return items.filter((d) => {
      const displayStatus = getDisplayStatus(d);
      if (tab !== "all" && displayStatus !== tab) return false;
      if (filter !== "all" && d.direction !== filter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !d.person_name.toLowerCase().includes(s) &&
          !(d.phone ?? "").toLowerCase().includes(s) &&
          !(d.notes ?? "").toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });
  }, [items, tab, filter, search]);

  const totals = useMemo(() => {
    let owedToMe = 0;
    let iOwe = 0;
    items.forEach((d) => {
      const remaining = getRemainingAmount(d);
      if (remaining <= 0) return;
      if (d.direction === "owed_to_me") owedToMe += remaining;
      else iOwe += remaining;
    });
    return { owedToMe, iOwe, net: owedToMe - iOwe };
  }, [items]);

  const { page, pageSize, setPage, setPageSize, visible, totalItems } = usePagination(filtered, {
    key: "debts",
    resetDeps: [tab, filter, search],
  });

  const selectedDebtRemaining = selectedDebt ? getRemainingAmount(selectedDebt) : 0;

  const startCreate = () => {
    setEditing(null);
    setForm({ ...empty });
    setOpen(true);
  };

  const startEdit = (d: Debt) => {
    setEditing(d);
    setForm({
      direction: d.direction,
      person_name: d.person_name,
      phone: d.phone ?? "",
      amount: String(d.amount),
      due_date: d.due_date ?? "",
      notes: d.notes ?? "",
    });
    setOpen(true);
  };

  const openPaymentsDialog = async (debt: Debt) => {
    setSelectedDebt(debt);
    setPaymentsOpen(true);
    setPaymentForm({
      ...emptyPayment,
      amount: debt.paid_amount > 0 ? String(getRemainingAmount(debt) || "") : "",
    });
    await loadPayments(debt.id);
  };

  const refreshDebtState = async (debtId?: string) => {
    const nextItems = await load();
    if (!debtId) return;
    const nextDebt = nextItems.find((item) => item.id === debtId) ?? null;
    setSelectedDebt(nextDebt);
    if (nextDebt) {
      await loadPayments(nextDebt.id);
    }
  };

  const save = async () => {
    if (!currentShop || !user) return;
    if (!form.person_name.trim()) return toast.error("Name is required");
    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Amount must be greater than 0");
    if (editing && amt < Number(editing.paid_amount ?? 0)) {
      return toast.error("Amount cannot be less than the amount already paid");
    }
    setSaving(true);

    const paidAmount = editing?.paid_amount ?? 0;
    const isSettled = paidAmount >= amt;
    const nextStatus: Status = isSettled ? "settled" : "open";
    const payload: TablesUpdate<"debts"> = {
      shop_id: currentShop.id,
      direction: form.direction,
      person_name: form.person_name.trim(),
      phone: form.phone.trim() || null,
      amount: amt,
      currency: cur,
      due_date: form.due_date || null,
      notes: form.notes.trim() || null,
      status: nextStatus,
      settled_at: isSettled ? editing?.settled_at ?? new Date().toISOString() : null,
    };

    let error;
    if (editing) {
      ({ error } = await supabase
        .from("debts")
        .update(payload)
        .eq("id", editing.id));
    } else {
      const insertPayload: TablesInsert<"debts"> = { ...payload, created_by: user.id, direction: form.direction, person_name: form.person_name.trim(), shop_id: currentShop.id };
      ({ error } = await supabase
        .from("debts")
        .insert(insertPayload));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Debt updated" : "Debt added");
    setOpen(false);
    await load();
  };

  const savePayment = async () => {
    if (!currentShop || !user || !selectedDebt) return;
    const amount = Number(paymentForm.amount);
    const remaining = getRemainingAmount(selectedDebt);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Amount must be greater than 0");
    if (paymentForm.kind === "payment" && amount > remaining) {
      return toast.error("Payment cannot be more than the remaining balance");
    }

    setPaymentSaving(true);
    const paymentPayload: TablesInsert<"debt_payments"> = {
      debt_id: selectedDebt.id,
      shop_id: currentShop.id,
      amount,
      payment_date: paymentForm.payment_date,
      notes: paymentForm.notes.trim() || null,
      created_by: user.id,
      kind: paymentForm.kind,
    };
    const { error } = await supabase
      .from("debt_payments")
      .insert(paymentPayload);
    setPaymentSaving(false);
    if (error) return toast.error(error.message);

    toast.success(paymentForm.kind === "payment" ? "Payment recorded" : "Debt increased");
    setPaymentForm({ ...emptyPayment });
    await refreshDebtState(selectedDebt.id);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("debts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Debt deleted");
    setConfirmId(null);
    await load();
  };

  const removePayment = async (id: string) => {
    const debtId = selectedDebt?.id;
    const { error } = await supabase.from("debt_payments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Payment deleted");
    setConfirmPaymentDeleteId(null);
    if (debtId) await refreshDebtState(debtId);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Debts</h1>
          <p className="text-sm text-muted-foreground">Track money you will receive and money you need to pay.</p>
        </div>
        {canManage && (
          <Button onClick={startCreate}>
            <Plus className="size-4 mr-2" /> Add debt
          </Button>
        )}
      </div>

      <PageTip id="debts.intro" title="Two directions: to receive, and to pay">
        Use <b>To receive</b> when a customer owes you (these are also created automatically from credit sales at POS).
        Use <b>To pay</b> for money your shop owes a supplier or anyone else. Add a payment any time and the remaining balance updates;
        once fully paid, the debt is marked <b>settled</b>.
      </PageTip>



      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <ArrowDownLeft className="size-4 text-success" /> To receive
          </div>
          <div className="text-lg sm:text-2xl font-bold mt-1 tabular-nums break-words leading-tight">{formatMoney(totals.owedToMe, cur)}</div>
          <div className="text-xs text-muted-foreground mt-1">Open remaining balance</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <ArrowUpRight className="size-4 text-destructive" /> To pay
          </div>
          <div className="text-lg sm:text-2xl font-bold mt-1 tabular-nums break-words leading-tight">{formatMoney(totals.iOwe, cur)}</div>
          <div className="text-xs text-muted-foreground mt-1">Open remaining balance</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Net balance</div>
          <div
            className={
              "text-lg sm:text-2xl font-bold mt-1 tabular-nums break-words leading-tight " +
              (totals.net >= 0 ? "text-success" : "text-destructive")
            }
          >
            {formatMoney(totals.net, cur)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Based on unpaid amounts only</div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "open" | "settled")}>
            <TabsList>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="settled">Settled</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as "all" | Direction)}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All directions</SelectItem>
                <SelectItem value="owed_to_me">To receive</SelectItem>
                <SelectItem value="i_owe">To pay</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Search name, phone, notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-56"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : visible.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No debts to show.</TableCell></TableRow>
              ) : visible.map((d) => {
                const remaining = getRemainingAmount(d);
                const displayStatus = getDisplayStatus(d);

                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-medium">{d.person_name}</div>
                      {d.phone && <div className="text-xs text-muted-foreground">{d.phone}</div>}
                    </TableCell>
                    <TableCell>
                      {d.direction === "owed_to_me" ? (
                        <Badge variant="outline" className="text-success border-success/40">
                          <ArrowDownLeft className="size-3 mr-1" /> To receive
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-destructive border-destructive/40">
                          <ArrowUpRight className="size-3 mr-1" /> To pay
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatMoney(d.amount, d.currency ?? cur)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(d.paid_amount ?? 0, d.currency ?? cur)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatMoney(remaining, d.currency ?? cur)}
                    </TableCell>
                    <TableCell className="text-sm">{d.due_date ?? "—"}</TableCell>
                    <TableCell>
                      {displayStatus === "open"
                        ? <Badge variant="secondary">Open</Badge>
                        : <Badge>Settled</Badge>}
                    </TableCell>
                    
                    <TableCell className="text-right">
                      {canManage && (
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => setDetails(d)} title="Details">
                            <Eye className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => void openPaymentsDialog(d)} title="Payments">
                            <Wallet className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => startEdit(d)} title="Edit">
                            <Pencil className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setConfirmId(d.id)} title="Delete">
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit debt" : "Add debt"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v as Direction })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owed_to_me">I will receive money</SelectItem>
                  <SelectItem value="i_owe">I will pay money</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Person name</Label>
                <Input value={form.person_name} onChange={(e) => setForm({ ...form, person_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone (optional)</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount ({cur})</Label>
                <Input type="number" inputMode="decimal" min="0" step="0.01"
                  value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                {editing && Number(editing.paid_amount ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Already paid: {formatMoney(editing.paid_amount, editing.currency ?? cur)}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Due date (optional)</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={paymentsOpen}
        onOpenChange={(nextOpen) => {
          setPaymentsOpen(nextOpen);
          if (!nextOpen) {
            setSelectedDebt(null);
            setPayments([]);
            setPaymentForm({ ...emptyPayment });
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Payments{selectedDebt ? ` · ${selectedDebt.person_name}` : ""}</DialogTitle>
          </DialogHeader>

          {selectedDebt && (
            <div className="space-y-4 py-2">
              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Total debt</div>
                  <div className="mt-1 font-semibold tabular-nums">{formatMoney(selectedDebt.amount, selectedDebt.currency ?? cur)}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Paid</div>
                  <div className="mt-1 font-semibold tabular-nums">{formatMoney(selectedDebt.paid_amount, selectedDebt.currency ?? cur)}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Remaining</div>
                  <div className="mt-1 font-semibold tabular-nums">{formatMoney(selectedDebtRemaining, selectedDebt.currency ?? cur)}</div>
                </Card>
              </div>

              {canManage && (
                <div className="rounded-md border p-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label>Entry type</Label>
                    <RadioGroup
                      value={paymentForm.kind}
                      onValueChange={(v) => setPaymentForm({ ...paymentForm, kind: v as EntryKind })}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                    >
                      <label
                        htmlFor="kind-payment"
                        className={
                          "flex items-start gap-2 rounded-md border p-3 cursor-pointer transition-colors " +
                          (paymentForm.kind === "payment" ? "border-primary bg-primary/5" : "hover:bg-muted/50")
                        }
                      >
                        <RadioGroupItem value="payment" id="kind-payment" className="mt-0.5" />
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium flex items-center gap-1.5">
                            <TrendingDown className="size-4 text-success" />
                            {selectedDebt.direction === "owed_to_me" ? "Receive payment" : "Make payment"}
                          </div>
                          <div className="text-xs text-muted-foreground">Reduces the remaining balance.</div>
                        </div>
                      </label>
                      <label
                        htmlFor="kind-increase"
                        className={
                          "flex items-start gap-2 rounded-md border p-3 cursor-pointer transition-colors " +
                          (paymentForm.kind === "increase" ? "border-primary bg-primary/5" : "hover:bg-muted/50")
                        }
                      >
                        <RadioGroupItem value="increase" id="kind-increase" className="mt-0.5" />
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium flex items-center gap-1.5">
                            <TrendingUp className="size-4 text-destructive" />
                            Add more debt
                          </div>
                          <div className="text-xs text-muted-foreground">Increases the total owed.</div>
                        </div>
                      </label>
                    </RadioGroup>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        max={paymentForm.kind === "payment" ? selectedDebtRemaining : undefined}
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={paymentForm.payment_date}
                        onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes (optional)</Label>
                    <Input
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      placeholder="Cash, bank transfer, note…"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={savePayment} disabled={paymentSaving} className="w-full sm:w-auto">
                      {paymentSaving ? "Saving…" : paymentForm.kind === "payment" ? "Record payment" : "Add debt"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-md border overflow-auto max-h-[50vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentsLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading entries…</TableCell>
                      </TableRow>
                    ) : payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No entries recorded yet.</TableCell>
                      </TableRow>
                    ) : payments.map((payment) => {
                      const isIncrease = payment.kind === "increase";
                      return (
                        <TableRow key={payment.id}>
                          <TableCell>{payment.payment_date}</TableCell>
                          <TableCell>
                            {isIncrease ? (
                              <Badge variant="outline" className="text-destructive border-destructive/40">
                                <TrendingUp className="size-3 mr-1" /> Added debt
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-success border-success/40">
                                <TrendingDown className="size-3 mr-1" /> Payment
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{payment.notes ?? "—"}</TableCell>
                          <TableCell className={"text-right tabular-nums font-medium " + (isIncrease ? "text-destructive" : "text-success")}>
                            {isIncrease ? "+" : "−"}{formatMoney(payment.amount, selectedDebt.currency ?? cur)}
                          </TableCell>
                          <TableCell className="text-right">
                            {canManage && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive"
                                onClick={() => setConfirmPaymentDeleteId(payment.id)}
                                title="Delete entry"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {details && (
        <DetailsDialog
          open={!!details}
          onClose={() => setDetails(null)}
          title={details.person_name}
          subtitle={details.direction === "owed_to_me" ? "To receive" : "To pay"}
          rows={[
            { label: "Type", value: details.direction === "owed_to_me" ? "I will receive money" : "I will pay money" },
            { label: "Status", value: getDisplayStatus(details) === "settled" ? "Settled" : "Open" },
            { label: "Phone", value: details.phone ?? "—" },
            { label: "Due date", value: details.due_date ?? "—" },
            { label: "Total amount", value: formatMoney(details.amount, details.currency ?? cur) },
            { label: "Paid", value: formatMoney(details.paid_amount ?? 0, details.currency ?? cur) },
            { label: "Remaining", value: formatMoney(getRemainingAmount(details), details.currency ?? cur) },
            { label: "Created", value: new Date(details.created_at).toLocaleString() },
            { label: "Settled at", value: details.settled_at ? new Date(details.settled_at).toLocaleString() : "—" },
            { label: "Notes", value: details.notes ?? "—", full: true },
          ]}
        />
      )}

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(v) => !v && setConfirmId(null)}
        title="Delete debt?"
        description="This action cannot be undone."
        variant="destructive"
        onConfirm={() => { if (confirmId) void remove(confirmId); }}
      />

      <ConfirmDialog
        open={!!confirmPaymentDeleteId}
        onOpenChange={(v) => !v && setConfirmPaymentDeleteId(null)}
        title="Delete payment?"
        description="The debt balance will be recalculated automatically."
        variant="destructive"
        onConfirm={() => { if (confirmPaymentDeleteId) void removePayment(confirmPaymentDeleteId); }}
      />
    </div>
  );
}
