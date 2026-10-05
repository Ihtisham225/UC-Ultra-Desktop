"use client";

/**
 * The payroll page, modelled on daily-cup: generate the period's payslips,
 * review and finalize them (figures lock), then pay. Each employee is paid on
 * their own cycle, so the page asks for a DATE and every row shows the pay
 * period that contains it.
 *
 * ⚠️ COPIED verbatim to the desktop app (`src/components/payroll/`). Anything
 * app-specific (navigation, the URL) comes in through props.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  Archive, ArchiveRestore, CheckCircle2, ChevronLeft, ChevronRight, FilePlus2, FileText, HandCoins,
  History, Lock, Pencil, Plus, Trash2, Users, Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DateInput } from "@/components/DateInput";
import { useAddNew } from "@/hooks/useAddNew";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { fmtDate } from "@/lib/date-format";
import { PAYMENT_TYPE_LABELS, type EmployeeDto, type PayrollOverviewDto } from "@/lib/payroll";
import { failure } from "@/lib/payroll";
import {
  SALARY_PERIOD_LABELS, periodFor, periodLabel, shiftPeriod, todayISO, type SalaryConfig,
} from "@/lib/salary-period";
import { payrollApi } from "@/components/payroll/payroll-api";
import { AdvanceDialog, EmployeeDialog, PayDialog, PayslipStatusBadge } from "@/components/payroll/PayrollDialogs";

type View = "active" | "archived" | "all";

const noopSubscribe = () => () => {};

export function PayrollScreen({
  currency,
  role,
  initialOn,
  onOnChange,
  onOpenPayslip,
  onOpenEmployee,
}: {
  currency: string;
  role: string | null | undefined;
  /** The day to show, when the URL asked for one. */
  initialOn?: string | null;
  /** Called when the shown day changes, so the page can keep it in the URL. */
  onOnChange?: (on: string) => void;
  onOpenPayslip: (id: string) => void;
  onOpenEmployee: (id: string) => void;
}) {
  const formatMoney = useFormatMoney();
  const money = (n: number) => formatMoney(n, currency);
  const isOwner = role === "owner";
  const canManage = role === "owner" || role === "manager";

  // Today isn't knowable on the server, so it is "" there and resolves on the
  // client (useSyncExternalStore keeps the two renders consistent).
  const today = useSyncExternalStore(noopSubscribe, todayISO, () => "");
  const [picked, setPicked] = useState("");
  const on = picked || (initialOn && /^\d{4}-\d{2}-\d{2}$/.test(initialOn) ? initialOn : today);
  const [data, setData] = useState<PayrollOverviewDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [empOpen, setEmpOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeDto | undefined>();
  const [prefill, setPrefill] = useState<{ user_id: string; name: string } | undefined>();
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [view, setView] = useState<View>("active");

  const setOn = (next: string) => {
    setPicked(next);
    onOnChange?.(next);
  };

  const load = useCallback(async () => {
    if (!on) return;
    try {
      setData(await payrollApi.overview(on));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load payroll");
    }
  }, [on]);
  // Loading is "the data on screen isn't for the day being asked about yet".
  const loading = !data || data.on !== on;

  useEffect(() => {
    void load();
  }, [load]);

  const rows = data?.rows ?? [];
  const employees = data?.employees ?? [];
  const active = employees.filter((e) => e.is_active);
  const missing = rows.filter((r) => !r.payslip && r.employee.is_active);
  const drafts = rows.filter((r) => r.payslip?.status === "draft");
  const finalized = rows.filter((r) => r.payslip?.status === "finalized");
  const slips = rows.flatMap((r) => (r.payslip ? [r.payslip] : []));
  const totalNet = slips.reduce((s, p) => s + p.net_pay, 0);
  const totalPaid = slips.filter((p) => p.status === "paid").reduce((s, p) => s + p.net_pay, 0);
  const totalGross = slips.reduce((s, p) => s + p.gross_pay, 0);
  const totalDeductions = slips.reduce((s, p) => s + p.total_deductions, 0);
  const shownEmployees = employees.filter((e) => (view === "all" ? true : view === "active" ? e.is_active : !e.is_active));

  /**
   * ‹ › step by whatever period the shop actually pays on — a week if everyone
   * is weekly, a month once the cycles differ (there is no one period to step).
   */
  const { stepConfig, uniform } = useMemo(() => {
    const first = active[0];
    const same =
      !!first &&
      active.every(
        (e) =>
          e.salary_period === first.salary_period &&
          e.salary_period_days === first.salary_period_days &&
          e.salary_anchor === first.salary_anchor,
      );
    const config: SalaryConfig = same
      ? { period: first.salary_period, periodDays: first.salary_period_days, anchor: first.salary_anchor }
      : { period: "monthly" };
    return { stepConfig: config, uniform: same };
  }, [active]);
  const step = (dir: -1 | 1) => on && setOn(shiftPeriod(stepConfig, on, dir).start);
  const showing = on ? periodLabel(stepConfig.period, periodFor(stepConfig, on)) : "";

  const openAdd = () => {
    setEditing(undefined);
    setPrefill(undefined);
    setEmpOpen(true);
  };

  useAddNew({ "payroll-payment": canManage && active.length > 0 && (() => setAdvanceOpen(true)) });

  const generate = async () => {
    setBusy(true);
    const res = await payrollApi.generate(on).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }));
    setBusy(false);
    if (failure(res)) return toast.error(failure(res)!);
    if (((res as { created?: number }).created ?? 0) === 0) toast.info("Every payslip for this period is already generated.");
    else toast.success(`${(res as { created?: number }).created} draft payslip${(res as { created?: number }).created === 1 ? "" : "s"} generated — review, then finalize.`);
    await load();
  };

  const finalizeAll = async () => {
    setConfirmFinalize(false);
    setBusy(true);
    const res = await payrollApi.finalize(drafts.map((r) => r.payslip!.id)).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }));
    setBusy(false);
    if (failure(res)) return toast.error(failure(res)!);
    toast.success("Payslips finalized — they're locked and ready to pay.");
    await load();
  };

  const toggleActive = async (e: EmployeeDto) => {
    const res = await payrollApi.setEmployeeActive(e.id, !e.is_active).catch((err: unknown) => ({ ok: false as const, error: err instanceof Error ? err.message : "Failed" }));
    if (failure(res)) return toast.error(failure(res)!);
    toast.success(e.is_active ? "Employee archived" : "Employee restored");
    await load();
  };

  const deletePayment = async (id: string) => {
    setDeleteId(null);
    const res = await payrollApi.deletePayment(id).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }));
    if (failure(res)) return toast.error(failure(res)!);
    toast.success("Payment deleted — the money is back in its account");
    await load();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="size-6 text-primary" /> Payroll
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate each period&apos;s payslips, finalize them to lock the figures, then mark them paid.
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Showing the pay period covering</Label>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" title="Previous period" onClick={() => step(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <DateInput className="w-fit" value={on} onChange={(e) => setOn(e.target.value || todayISO())} />
            <Button variant="outline" size="icon" title="Next period" onClick={() => step(1)}>
              <ChevronRight className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOn(todayISO())}>Today</Button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Users} label="Employees" value={String(active.length)} />
        <Stat icon={FileText} label={uniform && showing ? `Net payroll · ${showing}` : "Net payroll"} value={money(totalNet)} />
        <Stat icon={HandCoins} label="Paid" value={money(totalPaid)} />
        <Stat icon={Wallet} label="Still to pay" value={money(totalNet - totalPaid)} />
      </div>

      <Tabs defaultValue="payslips" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="payslips">Payslips</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="payments">Advances &amp; payments</TabsTrigger>
        </TabsList>

        {/* ── Payslips ─────────────────────────────────────────────────── */}
        <TabsContent value="payslips">
          <Card className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">Payslips{uniform && showing ? ` — ${showing}` : ""}</h2>
                <p className="text-sm text-muted-foreground">Drafts can be edited. Finalized payslips are locked.</p>
              </div>
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  {missing.length > 0 && (
                    <Button variant={drafts.length || finalized.length ? "outline" : "default"} onClick={() => void generate()} disabled={busy}>
                      <FilePlus2 className="size-4 me-1.5" /> Generate payslips ({missing.length})
                    </Button>
                  )}
                  {drafts.length > 0 && (
                    <Button variant={finalized.length ? "outline" : "default"} onClick={() => setConfirmFinalize(true)} disabled={busy}>
                      <Lock className="size-4 me-1.5" /> Finalize drafts ({drafts.length})
                    </Button>
                  )}
                  {finalized.length > 0 && (
                    <Button onClick={() => setPayOpen(true)} disabled={busy}>
                      <CheckCircle2 className="size-4 me-1.5" /> Pay finalized ({finalized.length})
                    </Button>
                  )}
                </div>
              )}
            </div>
            <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <li><span className="font-semibold text-foreground">1.</span> Generate — wage in, advances deducted</li>
              <li><span className="font-semibold text-foreground">2.</span> Review &amp; finalize — figures lock</li>
              <li><span className="font-semibold text-foreground">3.</span> Pay — mark paid</li>
            </ol>
            {loading && !data ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No one on payroll yet — add someone in the Employees tab.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Pay period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-end">Gross</TableHead>
                    <TableHead className="text-end">Deductions</TableHead>
                    <TableHead className="text-end">Net pay</TableHead>
                    <TableHead className="w-px" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={r.employee.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">
                        {r.employee.name}
                        {!r.employee.is_active && <Badge variant="outline" className="ms-2 text-[10px]">archived</Badge>}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {r.period_label}
                        <span className="block text-xs text-muted-foreground">{SALARY_PERIOD_LABELS[r.employee.salary_period]}</span>
                      </TableCell>
                      <TableCell>
                        {r.payslip ? (
                          <div className="grid gap-0.5">
                            <PayslipStatusBadge status={r.payslip.status} />
                            {r.payslip.paid_on && <span className="text-xs text-muted-foreground">{fmtDate(r.payslip.paid_on)}</span>}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Not generated{r.pending_advances > 0 && ` · ${money(r.pending_advances)} advanced`}
                          </span>
                        )}
                      </TableCell>
                      {r.payslip ? (
                        <>
                          <TableCell className="text-end tabular-nums">{money(r.payslip.gross_pay)}</TableCell>
                          <TableCell className="text-end tabular-nums text-muted-foreground">
                            {r.payslip.total_deductions > 0 ? `−${money(r.payslip.total_deductions)}` : "—"}
                          </TableCell>
                          <TableCell className="text-end tabular-nums font-semibold">{money(r.payslip.net_pay)}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-end tabular-nums text-muted-foreground">{money(r.employee.salary_amount)}</TableCell>
                          <TableCell className="text-end text-muted-foreground">—</TableCell>
                          <TableCell className="text-end text-muted-foreground">—</TableCell>
                        </>
                      )}
                      <TableCell className="text-end whitespace-nowrap">
                        {r.payslip && (
                          <Button size="sm" variant={r.payslip.status === "draft" ? "default" : "outline"} onClick={() => onOpenPayslip(r.payslip!.id)}>
                            {r.payslip.status === "draft" ? <Pencil className="size-3.5 me-1" /> : <FileText className="size-3.5 me-1" />}
                            {r.payslip.status === "draft" ? "Review" : "View"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {slips.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4}>Total</TableCell>
                      <TableCell className="text-end tabular-nums">{money(totalGross)}</TableCell>
                      <TableCell className="text-end tabular-nums">{totalDeductions > 0 ? `−${money(totalDeductions)}` : "—"}</TableCell>
                      <TableCell className="text-end tabular-nums">{money(totalNet)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* ── Employees ────────────────────────────────────────────────── */}
        <TabsContent value="employees">
          <Card className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 rounded-lg border p-0.5 text-sm">
                {(["active", "archived", "all"] as View[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={`rounded-md px-3 py-1 capitalize ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {v} ({v === "all" ? employees.length : v === "active" ? active.length : employees.length - active.length})
                  </button>
                ))}
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  {(data?.team.length ?? 0) > 0 && (
                    <Select
                      value=""
                      onValueChange={(uid) => {
                        const m = data?.team.find((t) => t.user_id === uid);
                        if (!m) return;
                        setEditing(undefined);
                        setPrefill(m);
                        setEmpOpen(true);
                      }}
                    >
                      <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Add from team…" /></SelectTrigger>
                      <SelectContent>
                        {data!.team.map((m) => (
                          <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button onClick={openAdd}><Plus className="size-4 me-1" /> Add employee</Button>
                </div>
              )}
            </div>
            {employees.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No one on payroll yet — add an employee{(data?.team.length ?? 0) > 0 ? ", or pick one from your team" : ""}.
              </p>
            ) : shownEmployees.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing here — switch the filter above.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead className="text-end">Wage</TableHead>
                    <TableHead className="w-px" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shownEmployees.map((e, i) => (
                    <TableRow key={e.id} className={e.is_active ? "" : "opacity-60"}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">
                        {e.name}
                        {!e.is_active && <Badge variant="outline" className="ms-2 text-[10px]">archived</Badge>}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {[e.phone, e.user_name ? `Login: ${e.user_name}` : null].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {e.salary_period === "custom" ? `Every ${e.salary_period_days ?? 1} days` : SALARY_PERIOD_LABELS[e.salary_period]}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{money(e.salary_amount)}</TableCell>
                      <TableCell className="text-end whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={() => onOpenEmployee(e.id)}>
                          <History className="size-3.5 me-1" /> History
                        </Button>
                        {canManage && (
                          <>
                            <Button size="icon" variant="ghost" title="Edit" onClick={() => { setEditing(e); setPrefill(undefined); setEmpOpen(true); }}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => void toggleActive(e)}>
                              {e.is_active ? <Archive className="size-3.5 me-1" /> : <ArchiveRestore className="size-3.5 me-1" />}
                              {e.is_active ? "Archive" : "Restore"}
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* ── Advances & payments ─────────────────────────────────────── */}
        <TabsContent value="payments">
          <Card className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">Advances &amp; payments</h2>
                <p className="text-sm text-muted-foreground">
                  Advances are deducted on the next payslip; salaries appear here once a payslip is paid.
                </p>
              </div>
              {canManage && (
                <Button onClick={() => setAdvanceOpen(true)} disabled={active.length === 0}>
                  <Plus className="size-4 me-1" /> Give advance
                </Button>
              )}
            </div>
            {(data?.payments.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Payslip</TableHead>
                    <TableHead className="text-end">Amount</TableHead>
                    {isOwner && <TableHead className="w-px" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap">{fmtDate(p.date)}</TableCell>
                      <TableCell className="font-medium">
                        {p.employee_name}
                        {p.note && <span className="block text-xs font-normal text-muted-foreground">{p.note}</span>}
                      </TableCell>
                      <TableCell><Badge variant="secondary">{PAYMENT_TYPE_LABELS[p.type]}</Badge></TableCell>
                      <TableCell className="text-sm">
                        {p.payslip_id ? (
                          <button type="button" className="hover:underline" onClick={() => onOpenPayslip(p.payslip_id!)}>
                            Paid · {p.payslip_label}
                          </button>
                        ) : p.recovered_on_id ? (
                          <button type="button" className="hover:underline" onClick={() => onOpenPayslip(p.recovered_on_id!)}>
                            Deducted · {p.recovered_on_label}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">{p.type === "advance" ? "Not on a payslip yet" : "—"}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{money(p.amount)}</TableCell>
                      {isOwner && (
                        <TableCell>
                          {!p.locked && (
                            <Button variant="ghost" size="icon" title="Delete payment" onClick={() => setDeleteId(p.id)}>
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <EmployeeDialog
        open={empOpen}
        onOpenChange={setEmpOpen}
        employee={editing}
        prefill={prefill}
        team={data?.team ?? []}
        onSaved={() => void load()}
      />
      <AdvanceDialog open={advanceOpen} onOpenChange={setAdvanceOpen} employees={active} onSaved={() => void load()} />
      <PayDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        payslips={finalized.map((r) => ({ id: r.payslip!.id, name: r.employee.name, net_pay: r.payslip!.net_pay }))}
        currency={currency}
        onPaid={() => void load()}
      />
      <ConfirmDialog
        open={confirmFinalize}
        onOpenChange={setConfirmFinalize}
        title={`Finalize ${drafts.length} payslip${drafts.length === 1 ? "" : "s"}?`}
        description="Their figures lock — nothing on them can be changed after this, only paid. Review any draft you haven't checked first."
        confirmLabel="Finalize"
        onConfirm={() => void finalizeAll()}
      />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="Delete this payment?"
        description="It is removed, and the money it took goes back into its account."
        variant="destructive"
        confirmLabel="Delete"
        onConfirm={() => { if (deleteId) void deletePayment(deleteId); }}
      />
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <Card className="px-5 py-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </Card>
  );
}
