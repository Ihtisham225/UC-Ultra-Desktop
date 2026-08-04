import { useCallback, useEffect, useMemo, useState } from "react";
import { rpc } from "@/lib/apiClient";
import { useShop } from "@/contexts/ShopContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useConfirm } from "@/components/ConfirmDialog";
import { Wallet, Users, HandCoins, Plus, Pencil, Trash2, FileText, Printer } from "lucide-react";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { usePageMeta } from "@/hooks/usePageMeta";
import { toast } from "sonner";

type PaymentType = "advance" | "salary" | "bonus";
interface StaffPayrollDto { user_id: string; name: string; role: string; monthly_salary: number; paid_this_month: number; balance: number; }
interface PayrollPaymentDto { id: string; date: string; type: PaymentType; amount: number; note: string | null; }
interface PayslipDto {
  staff: { user_id: string; name: string; role: string };
  month: string; monthly_salary: number; bonus_total: number; earned: number; paid_total: number; balance: number;
  lines: PayrollPaymentDto[];
}

const TYPE_LABELS: Record<PaymentType, string> = { advance: "Advance", salary: "Salary", bonus: "Bonus" };

function thisMonth(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default function Payroll() {
  usePageMeta({ title: "Payroll — UCU", description: "Staff salaries, advances and monthly payslips.", path: "/payroll" });
  const { currentShop, role } = useShop();
  const formatMoney = useFormatMoney();
  const cur = currentShop?.currency ?? "USD";
  const canManage = role === "owner" || role === "manager";

  const [month, setMonth] = useState(thisMonth());
  const [staff, setStaff] = useState<StaffPayrollDto[]>([]);
  const [payments, setPayments] = useState<Array<PayrollPaymentDto & { staff_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [salaryEdit, setSalaryEdit] = useState<{ staff: StaffPayrollDto; value: string } | null>(null);
  const [pay, setPay] = useState<{ staffUserId: string; date: string; type: PaymentType; amount: string; note: string } | null>(null);
  const [slip, setSlip] = useState<PayslipDto | null>(null);

  const load = useCallback(async () => {
    if (!currentShop) return;
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        rpc<StaffPayrollDto[]>("listStaffPayrollAction", month),
        rpc<Array<PayrollPaymentDto & { staff_name: string }>>("listRecentPaymentsAction", 100),
      ]);
      setStaff(s);
      setPayments(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load payroll");
    } finally {
      setLoading(false);
    }
  }, [currentShop, month]);

  useEffect(() => { load(); }, [load]);

  const onPayroll = staff.filter((s) => s.monthly_salary > 0);
  const totals = useMemo(() => ({
    paid: staff.reduce((a, s) => a + s.paid_this_month, 0),
    outstanding: onPayroll.reduce((a, s) => a + s.balance, 0),
  }), [staff, onPayroll]);

  const saveSalary = async () => {
    if (!salaryEdit) return;
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("setStaffSalaryAction", salaryEdit.staff.user_id, parseFloat(salaryEdit.value) || 0);
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) { return toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
    toast.success("Salary saved");
    setSalaryEdit(null);
    load();
  };

  const submitPayment = async () => {
    if (!pay) return;
    const amt = parseFloat(pay.amount) || 0;
    if (amt <= 0) return toast.error("Enter an amount");
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("createPayrollPaymentAction", {
        staff_user_id: pay.staffUserId, date: pay.date, type: pay.type, amount: amt, note: pay.note.trim() || null,
      });
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) { return toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
    toast.success("Payment recorded");
    setPay(null);
    load();
  };

  const deletePayment = async (id: string) => {
    const ok = await confirm({ title: "Delete payment", description: "Remove this payroll payment?", variant: "destructive" });
    if (!ok) return;
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("deletePayrollPaymentAction", id);
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) { return toast.error(e instanceof Error ? e.message : "Failed"); }
    toast.success("Deleted");
    load();
  };

  const openPay = (staffUserId?: string) => {
    const first = staffUserId ?? onPayroll[0]?.user_id ?? staff[0]?.user_id ?? "";
    setPay({ staffUserId: first, date: new Date().toISOString().slice(0, 10), type: "salary", amount: "", note: "" });
  };

  const openSlip = async (s: StaffPayrollDto) => {
    try {
      const data = await rpc<PayslipDto | null>("getPayslipAction", s.user_id, month);
      if (data) setSlip(data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="size-6 text-primary" /> Payroll</h1>
          <p className="text-sm text-muted-foreground mt-1">Advances and partial payments are netted against each person's salary on their monthly payslip.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="pr-month" className="text-xs">Month</Label>
          <Input id="pr-month" type="month" className="w-fit" value={month} onChange={(e) => setMonth(e.target.value || thisMonth())} />
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="px-5 py-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Users className="size-3.5" /> On payroll</div>
          <div className="text-xl font-bold tabular-nums">{onPayroll.length}</div>
        </Card>
        <Card className="px-5 py-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><HandCoins className="size-3.5" /> Paid in {monthLabel(month)}</div>
          <div className="text-xl font-bold tabular-nums">{formatMoney(totals.paid, cur)}</div>
        </Card>
        <Card className="px-5 py-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Wallet className="size-3.5" /> Outstanding</div>
          <div className="text-xl font-bold tabular-nums">{formatMoney(totals.outstanding, cur)}</div>
        </Card>
      </div>

      <Tabs defaultValue="staff" className="space-y-4">
        <TabsList>
          <TabsTrigger value="staff">Staff &amp; balances</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="staff">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-end">Salary</TableHead>
                  <TableHead className="text-end">Paid</TableHead>
                  <TableHead className="text-end">Balance</TableHead>
                  <TableHead className="w-44"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                ) : staff.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">No staff yet — add team members in Staff, then set their salary here.</TableCell></TableRow>
                ) : staff.map((s) => (
                  <TableRow key={s.user_id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{s.role}</Badge></TableCell>
                    <TableCell className="text-end tabular-nums">{s.monthly_salary > 0 ? formatMoney(s.monthly_salary, cur) : "—"}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatMoney(s.paid_this_month, cur)}</TableCell>
                    <TableCell className={`text-end tabular-nums font-semibold ${s.balance < 0 ? "text-destructive" : ""}`}>{s.monthly_salary > 0 ? formatMoney(s.balance, cur) : "—"}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" title="Payslip" onClick={() => openSlip(s)}><FileText className="size-3.5 me-1" /> Payslip</Button>
                        {canManage && (
                          <>
                            <Button variant="ghost" size="icon" title="Edit salary" onClick={() => setSalaryEdit({ staff: s, value: s.monthly_salary ? String(s.monthly_salary) : "" })}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" title="Pay" onClick={() => openPay(s.user_id)}>Pay</Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <div className="flex items-center justify-between p-4">
              <div>
                <h2 className="font-semibold">Recent payments</h2>
                <p className="text-xs text-muted-foreground">Advance, salary or bonus — cash paid out.</p>
              </div>
              {canManage && (
                <Button onClick={() => openPay()} disabled={staff.length === 0}><Plus className="size-4 me-1" /> Record payment</Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-end">Amount</TableHead>
                  {canManage && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow><TableCell colSpan={canManage ? 6 : 5} className="text-center text-muted-foreground py-10">No payments recorded yet.</TableCell></TableRow>
                ) : payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="tabular-nums whitespace-nowrap">{p.date}</TableCell>
                    <TableCell className="font-medium">{p.staff_name}</TableCell>
                    <TableCell><Badge variant="secondary">{TYPE_LABELS[p.type]}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{p.note ?? "—"}</TableCell>
                    <TableCell className="text-end tabular-nums font-medium">{formatMoney(p.amount, cur)}</TableCell>
                    {canManage && (
                      <TableCell><Button variant="ghost" size="icon" onClick={() => deletePayment(p.id)}><Trash2 className="size-4 text-destructive" /></Button></TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit salary */}
      <Dialog open={!!salaryEdit} onOpenChange={(o) => !o && setSalaryEdit(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Monthly salary — {salaryEdit?.staff.name}</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Monthly salary ({cur})</Label>
            <Input type="number" min="0" step="0.01" placeholder="0.00" value={salaryEdit?.value ?? ""} autoFocus
              onChange={(e) => setSalaryEdit((s) => s ? { ...s, value: e.target.value } : s)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalaryEdit(null)}>Cancel</Button>
            <Button onClick={saveSalary} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record payment */}
      <Dialog open={!!pay} onOpenChange={(o) => !o && setPay(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
          {pay && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Staff member</Label>
                <Select value={pay.staffUserId} onValueChange={(v) => setPay({ ...pay, staffUserId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{staff.map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={pay.type} onValueChange={(v) => setPay({ ...pay, type: v as PaymentType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salary">Salary</SelectItem>
                      <SelectItem value="advance">Advance</SelectItem>
                      <SelectItem value="bonus">Bonus</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5"><Label>Amount ({cur})</Label><Input type="number" min="0" step="0.01" placeholder="0.00" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} autoFocus /></div>
              <div className="space-y-1.5"><Label>Note</Label><Input value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} placeholder="Optional" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPay(null)}>Cancel</Button>
            <Button onClick={submitPayment} disabled={busy}>{busy ? "Saving…" : "Record payment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payslip */}
      <Dialog open={!!slip} onOpenChange={(o) => !o && setSlip(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Payslip</DialogTitle></DialogHeader>
          {slip && (
            <div id="payslip-print" className="space-y-4">
              <div className="text-center">
                <p className="text-lg font-bold">{currentShop?.name}</p>
                <p className="text-sm text-muted-foreground">Payslip · {monthLabel(slip.month)}</p>
              </div>
              <div className="grid gap-1 text-sm border-t pt-3">
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Staff</span><span className="font-medium">{slip.staff.name}</span></div>
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Role</span><span className="capitalize">{slip.staff.role}</span></div>
              </div>
              <div className="grid gap-1 text-sm border-t pt-3">
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
                        <span className="w-16 shrink-0 text-muted-foreground tabular-nums">{l.date.slice(5)}</span>
                        <span className="min-w-0 flex-1 truncate">{TYPE_LABELS[l.type]}{l.note ? ` · ${l.note}` : ""}</span>
                        <span className="shrink-0 font-medium tabular-nums">−{formatMoney(l.amount, cur)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between gap-2 border-t pt-1"><span className="text-muted-foreground">Total paid</span><span className="font-medium tabular-nums">−{formatMoney(slip.paid_total, cur)}</span></div>
                  </div>
                )}
              </div>
              <div className="flex items-baseline justify-between border-t pt-3">
                <span className="text-sm font-medium">{slip.balance >= 0 ? "Balance payable" : "Overpaid"}</span>
                <span className="text-2xl font-bold tabular-nums">{formatMoney(Math.abs(slip.balance), cur)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlip(null)}>Close</Button>
            <Button onClick={() => window.print()}><Printer className="size-4 me-1" /> Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
