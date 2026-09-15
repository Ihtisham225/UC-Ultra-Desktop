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
import { Wallet, Users, HandCoins, Plus, Pencil, Trash2, FileText, Printer, ChevronLeft, ChevronRight } from "lucide-react";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { usePageMeta } from "@/hooks/usePageMeta";
import { toast } from "sonner";
import { AccountPicker } from "@/components/AccountPicker";
import {
  SALARY_PERIODS,
  SALARY_PERIOD_LABELS,
  customDays,
  periodFor,
  periodLabel,
  salaryAmountLabel,
  shiftPeriod,
  todayISO,
  type SalaryConfig,
  type SalaryPeriod,
} from "@/lib/salary-period";
import { useAddNew } from "@/hooks/useAddNew";

type PaymentType = "advance" | "salary" | "bonus";
interface StaffPayrollDto {
  user_id: string;
  name: string;
  role: string;
  salary_amount: number;
  salary_period: SalaryPeriod;
  salary_period_days: number | null;
  salary_anchor: string | null;
  period_start: string;
  period_end: string;
  period_label: string;
  paid_this_period: number;
  balance: number;
}
interface PayrollPaymentDto { id: string; date: string; type: PaymentType; amount: number; note: string | null; }
interface PayslipDto {
  staff: { user_id: string; name: string; role: string };
  salary_period: SalaryPeriod;
  salary_period_days: number | null;
  period_start: string; period_end: string; period_label: string;
  prev_on: string; next_on: string;
  salary_amount: number; bonus_total: number; earned: number; paid_total: number; balance: number;
  lines: PayrollPaymentDto[];
}

const TYPE_LABELS: Record<PaymentType, string> = { advance: "Advance", salary: "Salary", bonus: "Bonus" };

/** Anchoring a daily cycle means nothing — every day is its own period. */
function anchorHelp(period: SalaryPeriod): string | null {
  switch (period) {
    case "daily": return null;
    case "weekly":
    case "biweekly": return "Leave blank for weeks starting on Monday.";
    case "custom": return "Leave blank to count from Monday, 5 January 1970.";
    default: return "Leave blank for calendar periods starting on the 1st.";
  }
}

/** How often a person is paid, in words. */
function cadenceLabel(period: SalaryPeriod, days: number | null): string {
  return period === "custom" ? `Every ${days ?? 0} days` : SALARY_PERIOD_LABELS[period];
}

interface SalaryDraft {
  staff: StaffPayrollDto;
  amount: string;
  period: SalaryPeriod;
  days: string;
  anchor: string;
}

export default function Payroll() {
  usePageMeta({ title: "Payroll — UCU", description: "Staff wages, advances and payslips on any pay cycle.", path: "/payroll" });
  const { currentShop, role } = useShop();
  const formatMoney = useFormatMoney();
  const cur = currentShop?.currency ?? "USD";
  const canManage = role === "owner" || role === "manager";

  // The day the screen is showing. Every staff member's own pay period is the
  // one containing it — they do not all run to the same calendar.
  const [on, setOn] = useState(todayISO());
  const [staff, setStaff] = useState<StaffPayrollDto[]>([]);
  const [payments, setPayments] = useState<Array<PayrollPaymentDto & { staff_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [salaryEdit, setSalaryEdit] = useState<SalaryDraft | null>(null);
  const [payAccountId, setPayAccountId] = useState<string | null>(null);
  const [pay, setPay] = useState<{ staffUserId: string; date: string; type: PaymentType; amount: string; note: string } | null>(null);
  const [slip, setSlip] = useState<PayslipDto | null>(null);
  // Whose payslip is open, so the dialog's arrows can fetch the next period.
  const [slipStaffId, setSlipStaffId] = useState("");

  const load = useCallback(async () => {
    if (!currentShop) return;
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        rpc<StaffPayrollDto[]>("listStaffPayrollAction", on),
        rpc<Array<PayrollPaymentDto & { staff_name: string }>>("listRecentPaymentsAction", 100),
      ]);
      setStaff(s);
      setPayments(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load payroll");
    } finally {
      setLoading(false);
    }
  }, [currentShop, on]);

  useEffect(() => { load(); }, [load]);

  const onPayroll = useMemo(() => staff.filter((s) => s.salary_amount > 0), [staff]);
  const totals = useMemo(() => ({
    paid: staff.reduce((a, s) => a + s.paid_this_period, 0),
    outstanding: onPayroll.reduce((a, s) => a + s.balance, 0),
  }), [staff, onPayroll]);

  /**
   * Stepping back and forward moves by whatever period the shop actually pays
   * on — by a week if everyone is weekly, by a month once the cadences differ
   * (there is no one period to step, and a month is the familiar default).
   */
  const { stepConfig, uniform } = useMemo(() => {
    const first = onPayroll[0];
    const same = !!first && onPayroll.every((s) =>
      s.salary_period === first.salary_period &&
      s.salary_period_days === first.salary_period_days &&
      s.salary_anchor === first.salary_anchor);
    const config: SalaryConfig = same
      ? { period: first.salary_period, periodDays: first.salary_period_days, anchor: first.salary_anchor }
      : { period: "monthly" };
    return { stepConfig: config, uniform: same };
  }, [onPayroll]);

  const step = (direction: -1 | 1) => setOn(shiftPeriod(stepConfig, on, direction).start);
  const showingLabel = periodLabel(stepConfig.period, periodFor(stepConfig, on));
  // The figure sums each person's OWN period, so it can only be named after a
  // window when everyone shares one — otherwise it would describe a different
  // set of payments than the label promises.
  const paidLabel = uniform ? `Paid in ${showingLabel}` : "Paid in each period";

  const openSalary = (s: StaffPayrollDto) => setSalaryEdit({
    staff: s,
    amount: s.salary_amount ? String(s.salary_amount) : "",
    period: s.salary_period,
    days: s.salary_period_days ? String(s.salary_period_days) : "15",
    anchor: s.salary_anchor ?? "",
  });

  const saveSalary = async () => {
    if (!salaryEdit) return;
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("setStaffSalaryAction", salaryEdit.staff.user_id, {
        amount: parseFloat(salaryEdit.amount) || 0,
        period: salaryEdit.period,
        period_days: salaryEdit.period === "custom" ? customDays(parseInt(salaryEdit.days, 10)) : null,
        anchor: salaryEdit.period === "daily" ? null : salaryEdit.anchor || null,
      });
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
        staff_user_id: pay.staffUserId, date: pay.date, type: pay.type, amount: amt,
        account_id: payAccountId, note: pay.note.trim() || null,
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

  useAddNew({ "payroll-payment": canManage && staff.length > 0 && (() => openPay()) });

  const openPay = (staffUserId?: string) => {
    const first = staffUserId ?? onPayroll[0]?.user_id ?? staff[0]?.user_id ?? "";
    setPay({ staffUserId: first, date: todayISO(), type: "salary", amount: "", note: "" });
  };

  const openSlip = async (staffUserId: string, when: string) => {
    try {
      const data = await rpc<PayslipDto | null>("getPayslipAction", staffUserId, when);
      if (data) { setSlipStaffId(staffUserId); setSlip(data); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  // The period the dialog's settings would produce right now, so the cadence is
  // shown as dates rather than left to the imagination.
  const salaryPreview = useMemo(() => {
    if (!salaryEdit) return null;
    const config: SalaryConfig = {
      period: salaryEdit.period,
      periodDays: salaryEdit.period === "custom" ? customDays(parseInt(salaryEdit.days, 10)) : null,
      anchor: salaryEdit.period === "daily" ? null : salaryEdit.anchor || null,
    };
    const p = periodFor(config, on);
    return { label: periodLabel(salaryEdit.period, p), days: p.days };
  }, [salaryEdit, on]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="size-6 text-primary" /> Payroll</h1>
          <p className="text-sm text-muted-foreground mt-1">Each person is paid on their own cycle — daily, weekly, monthly or anything you set. Advances and partial payments are netted against the wage for that cycle.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="pr-on" className="text-xs">Showing the period covering</Label>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" title="Previous period" onClick={() => step(-1)}><ChevronLeft className="size-4" /></Button>
            <Input id="pr-on" type="date" className="w-fit" value={on} onChange={(e) => setOn(e.target.value || todayISO())} />
            <Button variant="outline" size="icon" title="Next period" onClick={() => step(1)}><ChevronRight className="size-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setOn(todayISO())}>Today</Button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="px-5 py-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Users className="size-3.5" /> On payroll</div>
          <div className="text-xl font-bold tabular-nums">{onPayroll.length}</div>
        </Card>
        <Card className="px-5 py-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><HandCoins className="size-3.5" /> {paidLabel}</div>
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
                  <TableHead>Pay period</TableHead>
                  <TableHead className="text-end">Wage</TableHead>
                  <TableHead className="text-end">Paid</TableHead>
                  <TableHead className="text-end">Balance</TableHead>
                  <TableHead className="w-44"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                ) : staff.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">No staff yet — add team members in Staff, then set their wage here.</TableCell></TableRow>
                ) : staff.map((s) => (
                  <TableRow key={s.user_id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{s.role}</Badge></TableCell>
                    <TableCell>
                      {s.salary_amount > 0 ? (
                        <div className="leading-tight">
                          <div className="text-sm">{s.period_label}</div>
                          <div className="text-xs text-muted-foreground">{cadenceLabel(s.salary_period, s.salary_period_days)}</div>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{s.salary_amount > 0 ? formatMoney(s.salary_amount, cur) : "—"}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatMoney(s.paid_this_period, cur)}</TableCell>
                    <TableCell className={`text-end tabular-nums font-semibold ${s.balance < 0 ? "text-destructive" : ""}`}>{s.salary_amount > 0 ? formatMoney(s.balance, cur) : "—"}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" title="Payslip" onClick={() => openSlip(s.user_id, on)}><FileText className="size-3.5 me-1" /> Payslip</Button>
                        {canManage && (
                          <>
                            <Button variant="ghost" size="icon" title="Edit wage" onClick={() => openSalary(s)}>
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

      {/* Wage and pay period */}
      <Dialog open={!!salaryEdit} onOpenChange={(o) => !o && setSalaryEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Wage — {salaryEdit?.staff.name}</DialogTitle></DialogHeader>
          {salaryEdit && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Paid every</Label>
                <Select value={salaryEdit.period} onValueChange={(v) => setSalaryEdit({ ...salaryEdit, period: v as SalaryPeriod })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SALARY_PERIODS.map((p) => <SelectItem key={p} value={p}>{SALARY_PERIOD_LABELS[p]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {salaryEdit.period === "custom" && (
                <div className="space-y-1.5">
                  <Label>Period length (days)</Label>
                  <Input type="number" min="1" step="1" value={salaryEdit.days}
                    onChange={(e) => setSalaryEdit({ ...salaryEdit, days: e.target.value })} />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>{salaryAmountLabel(salaryEdit.period, customDays(parseInt(salaryEdit.days, 10)))} ({cur})</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={salaryEdit.amount} autoFocus
                  onChange={(e) => setSalaryEdit({ ...salaryEdit, amount: e.target.value })} />
              </div>

              {anchorHelp(salaryEdit.period) && (
                <div className="space-y-1.5">
                  <Label>Cycle starts on</Label>
                  <Input type="date" value={salaryEdit.anchor}
                    onChange={(e) => setSalaryEdit({ ...salaryEdit, anchor: e.target.value })} />
                  <p className="text-xs text-muted-foreground">{anchorHelp(salaryEdit.period)}</p>
                </div>
              )}

              {salaryPreview && (
                <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Current period: <span className="font-medium text-foreground">{salaryPreview.label}</span>
                  {" · "}{salaryPreview.days} day{salaryPreview.days === 1 ? "" : "s"}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalaryEdit(null)}>Cancel</Button>
            <Button onClick={saveSalary} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record payment */}
      <Dialog open={!!pay} onOpenChange={(o) => !o && setPay(null)}>
        <DialogContent data-add-new="payroll-payment" className="sm:max-w-lg">
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
              <AccountPicker value={payAccountId} onChange={setPayAccountId} label="Paid from" />
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
                <p className="text-sm text-muted-foreground">Payslip · {slip.period_label}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{slip.period_start} → {slip.period_end}</p>
              </div>
              <div className="grid gap-1 text-sm border-t pt-3">
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Staff</span><span className="font-medium">{slip.staff.name}</span></div>
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Role</span><span className="capitalize">{slip.staff.role}</span></div>
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Paid every</span><span>{cadenceLabel(slip.salary_period, slip.salary_period_days)}</span></div>
              </div>
              <div className="grid gap-1 text-sm border-t pt-3">
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">{salaryAmountLabel(slip.salary_period, slip.salary_period_days)}</span><span className="font-medium tabular-nums">{formatMoney(slip.salary_amount, cur)}</span></div>
                {slip.bonus_total > 0 && <div className="flex justify-between gap-2"><span className="text-muted-foreground">Bonus</span><span className="font-medium tabular-nums">+{formatMoney(slip.bonus_total, cur)}</span></div>}
                <div className="flex justify-between gap-2 border-t pt-1"><span className="text-muted-foreground">Total earned</span><span className="font-medium tabular-nums">{formatMoney(slip.earned, cur)}</span></div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Paid during the period</p>
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
          <DialogFooter className="print:hidden">
            <Button variant="outline" size="icon" title="Previous period" onClick={() => slip && openSlip(slipStaffId, slip.prev_on)}><ChevronLeft className="size-4" /></Button>
            <Button variant="outline" size="icon" title="Next period" onClick={() => slip && openSlip(slipStaffId, slip.next_on)}><ChevronRight className="size-4" /></Button>
            <Button variant="outline" onClick={() => setSlip(null)}>Close</Button>
            <Button onClick={() => window.print()}><Printer className="size-4 me-1" /> Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
