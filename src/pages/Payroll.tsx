import { useCallback, useEffect, useMemo, useState } from "react";
import { rpc } from "@/lib/apiClient";
import { useShop } from "@/contexts/ShopContext";
import { usePermissions } from "@/hooks/usePermissions";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfirm } from "@/components/ConfirmDialog";
import { Wallet, Plus, Pencil, Trash2, Users, HandCoins, FileText, Archive, RotateCcw, Printer } from "lucide-react";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { toast } from "sonner";

type PaymentType = "advance" | "salary" | "bonus";

interface EmployeeSummaryDto {
  id: string; name: string; phone: string | null;
  monthly_salary: number; is_active: boolean;
  paid_this_month: number; balance: number;
}
interface PayrollPaymentDto { id: string; date: string; type: PaymentType; amount: number; note: string | null; }
interface PayslipDto {
  employee: { id: string; name: string; phone: string | null };
  month: string; monthly_salary: number; bonus_total: number;
  earned: number; paid_total: number; balance: number; lines: PayrollPaymentDto[];
}

const TYPE_LABELS: Record<PaymentType, string> = { advance: "Advance", salary: "Salary", bonus: "Bonus" };

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" });
}
function todayStr(): string { return new Date().toISOString().slice(0, 10); }

interface EditingEmployee { id?: string; name: string; phone: string; monthly_salary: string; }

export default function Payroll() {
  usePageMeta({ title: "Payroll — UCU", description: "Staff salaries, advances and monthly payslips.", path: "/payroll" });
  const { currentShop } = useShop();
  const { role } = usePermissions();
  const isOwner = role === "owner";
  const formatMoney = useFormatMoney();
  const cur = currentShop?.currency ?? "USD";

  const [month, setMonth] = useState(currentMonth());
  const [employees, setEmployees] = useState<EmployeeSummaryDto[]>([]);
  const [payments, setPayments] = useState<Array<PayrollPaymentDto & { employee_name: string }>>([]);
  const [team, setTeam] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [editing, setEditing] = useState<EditingEmployee | null>(null);
  const [payFor, setPayFor] = useState<{ employee_id: string; date: string; type: PaymentType; amount: string; note: string } | null>(null);
  const [slip, setSlip] = useState<PayslipDto | null>(null);

  const load = useCallback(async () => {
    if (!currentShop) return;
    setLoading(true);
    try {
      const [emps, pays, tm] = await Promise.all([
        rpc<EmployeeSummaryDto[]>("listEmployeesWithMonthAction", month),
        rpc<Array<PayrollPaymentDto & { employee_name: string }>>("listRecentPaymentsAction", 50),
        rpc<Array<{ id: string; name: string }>>("listTeamForPayrollAction"),
      ]);
      setEmployees(emps);
      setPayments(pays);
      setTeam(tm);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load payroll");
    } finally {
      setLoading(false);
    }
  }, [currentShop, month]);

  useEffect(() => { load(); }, [load]);

  const activeEmployees = useMemo(() => employees.filter((e) => e.is_active), [employees]);
  const totals = useMemo(() => ({
    staff: activeEmployees.length,
    paid: employees.reduce((s, e) => s + e.paid_this_month, 0),
    outstanding: activeEmployees.reduce((s, e) => s + e.balance, 0),
  }), [employees, activeEmployees]);

  const existingNames = useMemo(() => new Set(employees.map((e) => e.name.trim().toLowerCase())), [employees]);
  const addableTeam = team.filter((m) => !existingNames.has(m.name.trim().toLowerCase()));

  const saveEmployee = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error("Name is required");
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("saveEmployeeAction", {
        id: editing.id,
        name: editing.name.trim(),
        phone: editing.phone.trim() || null,
        monthly_salary: parseFloat(editing.monthly_salary) || 0,
      });
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
    toast.success(editing.id ? "Employee updated" : "Employee added");
    setEditing(null);
    load();
  };

  const toggleActive = async (e: EmployeeSummaryDto) => {
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("setEmployeeActiveAction", e.id, !e.is_active);
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : "Failed");
    }
    toast.success(e.is_active ? "Employee archived" : "Employee restored");
    load();
  };

  const removeEmployee = async (e: EmployeeSummaryDto) => {
    const ok = await confirm({
      title: "Delete employee",
      description: `Delete ${e.name}? Their payment history will be removed too. Use Archive instead to keep the history.`,
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("deleteEmployeeAction", e.id);
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : "Failed");
    }
    toast.success("Deleted");
    load();
  };

  const submitPayment = async () => {
    if (!payFor) return;
    const amt = parseFloat(payFor.amount) || 0;
    if (amt <= 0) return toast.error("Enter an amount");
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("createPayrollPaymentAction", {
        employee_id: payFor.employee_id,
        date: payFor.date,
        type: payFor.type,
        amount: amt,
        note: payFor.note.trim() || null,
      });
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
    toast.success("Payment recorded");
    setPayFor(null);
    load();
  };

  const removePayment = async (id: string) => {
    const ok = await confirm({ title: "Delete payment", description: "Remove this payment?", variant: "destructive" });
    if (!ok) return;
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("deletePayrollPaymentAction", id);
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    }
    toast.success("Payment deleted");
    load();
  };

  const openPayment = (employeeId?: string) =>
    setPayFor({ employee_id: employeeId ?? activeEmployees[0]?.id ?? "", date: todayStr(), type: "salary", amount: "", note: "" });

  const openPayslip = async (employeeId: string) => {
    try {
      const s = await rpc<PayslipDto | null>("getPayslipAction", employeeId, month);
      if (s) setSlip(s);
      else toast.error("Payslip not found");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load payslip");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="size-6 text-primary" /> Payroll
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Advances and partial payments are netted against each person's salary on their monthly payslip.
          </p>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="pr-month" className="text-xs">Month</Label>
          <Input id="pr-month" type="month" className="w-fit" value={month} onChange={(e) => setMonth(e.target.value || currentMonth())} />
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="px-5 py-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Users className="size-3.5" /> Staff</div>
          <div className="text-xl font-bold tabular-nums">{totals.staff}</div>
        </Card>
        <Card className="px-5 py-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1"><HandCoins className="size-3.5" /> Paid in {monthLabel(month)}</div>
          <div className="text-xl font-bold tabular-nums">{formatMoney(totals.paid, cur)}</div>
        </Card>
        <Card className="px-5 py-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Wallet className="size-3.5" /> Outstanding balance</div>
          <div className="text-xl font-bold tabular-nums">{formatMoney(totals.outstanding, cur)}</div>
        </Card>
      </div>

      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff">Staff &amp; balances</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="mt-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 p-4">
              <h2 className="font-semibold">Staff &amp; balances — {monthLabel(month)}</h2>
              <div className="flex items-center gap-2">
                {addableTeam.length > 0 && (
                  <Select value="" onValueChange={(v) => setEditing({ name: v, phone: "", monthly_salary: "" })}>
                    <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Add from team…" /></SelectTrigger>
                    <SelectContent>
                      {addableTeam.map((m) => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <Button onClick={() => setEditing({ name: "", phone: "", monthly_salary: "" })}>
                  <Plus className="size-4 me-1" /> Add employee
                </Button>
              </div>
            </div>
            <div className="border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-end">Salary</TableHead>
                    <TableHead className="text-end">Paid</TableHead>
                    <TableHead className="text-end">Balance</TableHead>
                    <TableHead className="w-56"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                  ) : employees.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">No staff on payroll yet — add someone above{addableTeam.length > 0 ? ", or pick one from your team." : "."}</TableCell></TableRow>
                  ) : employees.map((e) => (
                    <TableRow key={e.id} className={e.is_active ? "" : "opacity-60"}>
                      <TableCell className="font-medium">
                        {e.name}
                        {!e.is_active && <Badge variant="outline" className="ms-2 text-[10px]">archived</Badge>}
                        {e.phone && <span className="block text-xs text-muted-foreground">{e.phone}</span>}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{formatMoney(e.monthly_salary, cur)}</TableCell>
                      <TableCell className="text-end tabular-nums">{formatMoney(e.paid_this_month, cur)}</TableCell>
                      <TableCell className={`text-end tabular-nums font-medium ${e.balance > 0 ? "" : "text-muted-foreground"}`}>{formatMoney(e.balance, cur)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {e.is_active && <Button size="sm" variant="outline" onClick={() => openPayment(e.id)}>Pay</Button>}
                          <Button size="icon" variant="ghost" title="Payslip" onClick={() => openPayslip(e.id)}><FileText className="size-4" /></Button>
                          <Button size="icon" variant="ghost" title="Edit" onClick={() => setEditing({ id: e.id, name: e.name, phone: e.phone ?? "", monthly_salary: String(e.monthly_salary) })}><Pencil className="size-4" /></Button>
                          <Button size="icon" variant="ghost" title={e.is_active ? "Archive" : "Restore"} onClick={() => toggleActive(e)}>
                            {e.is_active ? <Archive className="size-4" /> : <RotateCcw className="size-4" />}
                          </Button>
                          {isOwner && <Button size="icon" variant="ghost" title="Delete" onClick={() => removeEmployee(e)}><Trash2 className="size-4 text-destructive" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div>
                <h2 className="font-semibold">Recent payments</h2>
                <p className="text-xs text-muted-foreground">Advance, salary or bonus — cash paid out.</p>
              </div>
              <Button onClick={() => openPayment()} disabled={activeEmployees.length === 0}>
                <Plus className="size-4 me-1" /> Record payment
              </Button>
            </div>
            <div className="border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-end">Amount</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                  ) : payments.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">No payments recorded yet.</TableCell></TableRow>
                  ) : payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="tabular-nums whitespace-nowrap">{p.date}</TableCell>
                      <TableCell className="font-medium">{p.employee_name}</TableCell>
                      <TableCell><Badge variant="secondary">{TYPE_LABELS[p.type]}</Badge>{p.note && <span className="block text-xs text-muted-foreground">{p.note}</span>}</TableCell>
                      <TableCell className="text-end tabular-nums">{formatMoney(p.amount, cur)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" title="Delete" onClick={() => removePayment(p.id)}><Trash2 className="size-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add / edit employee */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit employee" : "Add employee"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Name *</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus /></div>
                <div className="space-y-1.5"><Label>Phone</Label><Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Monthly salary</Label><Input type="number" min="0" step="0.01" placeholder="0.00" value={editing.monthly_salary} onChange={(e) => setEditing({ ...editing, monthly_salary: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEmployee} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record payment */}
      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
          {payFor && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Staff member *</Label>
                <Select value={payFor.employee_id} onValueChange={(v) => setPayFor({ ...payFor, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick a staff member" /></SelectTrigger>
                  <SelectContent>{activeEmployees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={payFor.date} onChange={(e) => setPayFor({ ...payFor, date: e.target.value })} /></div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={payFor.type} onValueChange={(v) => setPayFor({ ...payFor, type: v as PaymentType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salary">Salary</SelectItem>
                      <SelectItem value="advance">Advance</SelectItem>
                      <SelectItem value="bonus">Bonus</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5"><Label>Amount *</Label><Input type="number" min="0" step="0.01" placeholder="0.00" value={payFor.amount} onChange={(e) => setPayFor({ ...payFor, amount: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Note</Label><Input value={payFor.note} onChange={(e) => setPayFor({ ...payFor, note: e.target.value })} placeholder="Optional" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFor(null)}>Cancel</Button>
            <Button onClick={submitPayment} disabled={busy || !payFor?.employee_id}>{busy ? "Saving…" : "Record payment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payslip */}
      <Dialog open={!!slip} onOpenChange={(o) => !o && setSlip(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader className="flex-row items-center justify-between print:hidden">
            <DialogTitle>Payslip</DialogTitle>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4 me-1" /> Print</Button>
          </DialogHeader>
          {slip && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-lg font-bold">{currentShop?.name}</p>
                <p className="text-sm text-muted-foreground">Payslip · {monthLabel(slip.month)}</p>
              </div>
              <div className="border-t" />
              <div className="grid gap-1 text-sm">
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Employee</span><span className="font-medium">{slip.employee.name}</span></div>
                {slip.employee.phone && <div className="flex justify-between gap-2"><span className="text-muted-foreground">Phone</span><span>{slip.employee.phone}</span></div>}
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Monthly salary</span><span className="font-medium tabular-nums">{formatMoney(slip.monthly_salary, cur)}</span></div>
                {slip.bonus_total > 0 && <div className="flex justify-between gap-2"><span className="text-muted-foreground">Bonus</span><span className="font-medium tabular-nums">+{formatMoney(slip.bonus_total, cur)}</span></div>}
                <div className="flex justify-between gap-2 border-t pt-1"><span className="text-muted-foreground">Total earned</span><span className="font-medium tabular-nums">{formatMoney(slip.earned, cur)}</span></div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Paid during the month</p>
                {slip.lines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments recorded.</p>
                ) : (
                  <div className="grid gap-1 text-sm">
                    {slip.lines.map((l) => (
                      <div key={l.id} className="flex items-baseline gap-2">
                        <span className="w-14 shrink-0 text-muted-foreground tabular-nums">{l.date.slice(5)}</span>
                        <span className="min-w-0 flex-1 truncate">{TYPE_LABELS[l.type]}{l.note ? ` · ${l.note}` : ""}</span>
                        <span className="shrink-0 font-medium tabular-nums">−{formatMoney(l.amount, cur)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between gap-2 border-t pt-1"><span className="text-muted-foreground">Total paid</span><span className="font-medium tabular-nums">−{formatMoney(slip.paid_total, cur)}</span></div>
                  </div>
                )}
              </div>
              <div className="border-t" />
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">{slip.balance >= 0 ? "Balance payable" : "Overpaid"}</span>
                <span className="text-2xl font-bold tabular-nums">{formatMoney(Math.abs(slip.balance), cur)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
