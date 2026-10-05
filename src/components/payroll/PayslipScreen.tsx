"use client";

/**
 * One payslip: an editor while it is a draft (unpaid days, earnings,
 * deductions, which advances to deduct), and a locked, printable slip once it
 * is finalized or paid. Modelled on daily-cup's payslip page.
 *
 * ⚠️ COPIED verbatim to the desktop app (`src/components/payroll/`). Navigation
 * and printing come in through props.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Lock, Plus, Printer, RefreshCw, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { fmtDate } from "@/lib/date-format";
import {
  DEDUCTION_SUGGESTIONS,
  EARNING_SUGGESTIONS,
  PAYMENT_TYPE_LABELS,
  computePayslip,
  type PayslipDetailDto,
  type PayslipLineKind,
  type PayrollResult,
} from "@/lib/payroll";
import { failure } from "@/lib/payroll";
import { payrollApi } from "@/components/payroll/payroll-api";
import { PayDialog, PayslipStatusBadge } from "@/components/payroll/PayrollDialogs";

type Line = { kind: PayslipLineKind; label: string; amount: string };
type Confirm = "discard" | "cancel" | "undo" | null;

export function PayslipScreen({
  id,
  shopName,
  currency,
  role,
  onBack,
  onPrint,
}: {
  id: string;
  shopName: string;
  currency: string;
  role: string | null | undefined;
  onBack: () => void;
  /** Print the slip — the browser's print on the web, an A4 PDF on the desktop. */
  onPrint: () => void;
}) {
  const isOwner = role === "owner";
  const canManage = role === "owner" || role === "manager";
  const [slip, setSlip] = useState<PayslipDetailDto | null | undefined>(undefined);
  const [payOpen, setPayOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSlip(await payrollApi.payslip(id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load the payslip");
      setSlip(null);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<PayrollResult>, success: string, after?: () => void) => {
    setBusy(true);
    const res = await action().catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }));
    setBusy(false);
    setConfirm(null);
    if (failure(res)) return toast.error(failure(res)!);
    toast.success(success);
    if (after) after();
    else await load();
  };

  if (slip === undefined) return <p className="py-12 text-center text-sm text-muted-foreground">Loading payslip…</p>;
  if (slip === null) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4 me-1" /> Back to payroll</Button>
        <p className="py-12 text-center text-sm text-muted-foreground">That payslip no longer exists.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4 me-1" /> Back to payroll</Button>
        <div className="flex flex-wrap gap-2">
          {slip.status === "finalized" && canManage && (
            <>
              {isOwner && (
                <Button variant="outline" size="sm" onClick={() => setConfirm("cancel")} disabled={busy}>
                  <X className="size-4 me-1" /> Cancel payslip
                </Button>
              )}
              <Button size="sm" onClick={() => setPayOpen(true)} disabled={busy}>
                <CheckCircle2 className="size-4 me-1" /> Mark as paid
              </Button>
            </>
          )}
          {slip.status === "paid" && isOwner && (
            <Button variant="outline" size="sm" onClick={() => setConfirm("undo")} disabled={busy}>
              <Undo2 className="size-4 me-1" /> Undo payment
            </Button>
          )}
          {slip.status !== "draft" && (
            <Button variant="outline" size="sm" onClick={onPrint}>
              <Printer className="size-4 me-1" /> Print
            </Button>
          )}
        </div>
      </div>

      {slip.status === "draft" && canManage ? (
        // Keyed so a reload after saving starts the editor from the stored figures.
        <DraftEditor
          key={`${slip.id}:${slip.basic_salary}`}
          slip={slip}
          currency={currency}
          busy={busy}
          onDiscard={() => setConfirm("discard")}
          onChanged={() => void load()}
        />
      ) : (
        <PayslipView slip={slip} shopName={shopName} currency={currency} />
      )}

      <PayDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        payslips={[{ id: slip.id, name: slip.employee.name, net_pay: slip.net_pay }]}
        currency={currency}
        onPaid={() => void load()}
      />
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={confirm === "discard" ? "Discard this draft?" : confirm === "cancel" ? "Cancel this payslip?" : "Undo the payment?"}
        description={
          confirm === "discard"
            ? "The draft is deleted and its advances go back to outstanding. You can generate it again from the payroll page."
            : confirm === "cancel"
              ? "The finalized payslip is deleted and its advances go back to outstanding, so it can be generated again."
              : "The salary payment is removed, its money goes back into the account, and the payslip returns to finalized, unpaid."
        }
        variant="destructive"
        busy={busy}
        confirmLabel={confirm === "discard" ? "Discard" : confirm === "cancel" ? "Cancel payslip" : "Undo payment"}
        onConfirm={() => {
          if (confirm === "discard" || confirm === "cancel") {
            void run(() => payrollApi.deletePayslip(slip.id), confirm === "discard" ? "Draft discarded" : "Payslip cancelled", onBack);
          } else if (confirm === "undo") {
            void run(() => payrollApi.undoPayment(slip.id), "Payment undone");
          }
        }}
      />
    </div>
  );
}

// ─── Draft editor ────────────────────────────────────────────────────────────

function DraftEditor({
  slip,
  currency,
  busy,
  onDiscard,
  onChanged,
}: {
  slip: PayslipDetailDto;
  currency: string;
  busy: boolean;
  onDiscard: () => void;
  onChanged: () => void;
}) {
  const formatMoney = useFormatMoney();
  const money = (n: number) => formatMoney(n, currency);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [unpaidDays, setUnpaidDays] = useState(String(slip.unpaid_days));
  const [lines, setLines] = useState<Line[]>(slip.lines.map((l) => ({ kind: l.kind, label: l.label, amount: String(l.amount) })));
  const [included, setIncluded] = useState<Set<string>>(() => new Set(slip.advances.filter((a) => a.included).map((a) => a.id)));
  const [note, setNote] = useState(slip.note ?? "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const advanceTotal = slip.advances.filter((a) => included.has(a.id)).reduce((s, a) => s + a.amount, 0);
  const totals = useMemo(
    () =>
      computePayslip({
        basicSalary: slip.basic_salary,
        daysInPeriod: slip.days_in_period,
        unpaidDays: Number(unpaidDays) || 0,
        lines: lines.map((l) => ({ kind: l.kind, amount: Number(l.amount) || 0 })),
        advances: advanceTotal,
      }),
    [slip.basic_salary, slip.days_in_period, unpaidDays, lines, advanceTotal],
  );

  const touch = () => setDirty(true);
  const addLine = (kind: PayslipLineKind, label = "") => {
    setLines((ls) => [...ls, { kind, label, amount: "" }]);
    touch();
  };
  const updateLine = (i: number, patch: Partial<Line>) => {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
    touch();
  };
  const removeLine = (i: number) => {
    setLines((ls) => ls.filter((_, j) => j !== i));
    touch();
  };
  const toggleAdvance = (id: string) => {
    setIncluded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    touch();
  };

  const save = async (): Promise<boolean> => {
    if (lines.some((l) => !l.label.trim() || !(Number(l.amount) > 0))) {
      toast.error("Every line needs a name and an amount above 0.");
      return false;
    }
    setSaving(true);
    const res = await payrollApi
      .saveDraft({
        id: slip.id,
        unpaid_days: Number(unpaidDays) || 0,
        lines: lines.map((l) => ({ kind: l.kind, label: l.label.trim(), amount: Number(l.amount) })),
        advance_ids: [...included],
        note: note.trim() || null,
      })
      .catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed to save" }));
    setSaving(false);
    if (failure(res)) {
      toast.error(failure(res)!);
      return false;
    }
    setDirty(false);
    return true;
  };

  const saveAndFinalize = async () => {
    if (totals.netPay < 0) return toast.error("Deductions are more than the pay — carry an advance forward.");
    if (!(await save())) return;
    setSaving(true);
    const res = await payrollApi.finalize([slip.id]).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }));
    setSaving(false);
    if (failure(res)) return toast.error(failure(res)!);
    toast.success("Payslip finalized — it's locked and ready to pay.");
    onChanged();
  };

  const syncSalary = async () => {
    setSaving(true);
    const res = await payrollApi.syncSalary(slip.id).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }));
    setSaving(false);
    if (failure(res)) return toast.error(failure(res)!);
    toast.success("Wage updated");
    onChanged();
  };

  const earnings = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.kind === "earning");
  const deductions = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.kind === "deduction");
  const disabled = busy || saving;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="p-5 space-y-5">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            {slip.employee.name} <PayslipStatusBadge status="draft" />
          </h1>
          <p className="text-sm text-muted-foreground">Payslip for {slip.period_label} — still editable. Finalize to lock it.</p>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border p-3">
          <div>
            <p className="text-xs text-muted-foreground">Wage for the period</p>
            <p className="text-lg font-semibold tabular-nums">{money(slip.basic_salary)}</p>
            {slip.current_salary !== slip.basic_salary && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Their wage is now {money(slip.current_salary)}.{" "}
                <button type="button" className="inline-flex items-center gap-1 underline" onClick={() => void syncSalary()} disabled={disabled}>
                  <RefreshCw className="size-3" /> Use it
                </button>
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="ps-unpaid" className="text-xs">Unpaid days (of {slip.days_in_period})</Label>
            <Input
              id="ps-unpaid"
              type="number"
              min={0}
              max={slip.days_in_period}
              step="0.5"
              inputMode="decimal"
              className="h-9 w-28"
              value={unpaidDays}
              onChange={(e) => {
                setUnpaidDays(e.target.value);
                touch();
              }}
            />
          </div>
        </div>

        <LineSection title="Earnings" hint="Added to pay" rows={earnings} suggestions={EARNING_SUGGESTIONS}
          onAdd={(label) => addLine("earning", label)} onUpdate={updateLine} onRemove={removeLine} />
        <LineSection title="Deductions" hint="Taken off pay" rows={deductions} suggestions={DEDUCTION_SUGGESTIONS}
          onAdd={(label) => addLine("deduction", label)} onUpdate={updateLine} onRemove={removeLine} />

        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">Advances to deduct</p>
            <p className="text-xs text-muted-foreground">Untick one to carry it forward to the next payslip.</p>
          </div>
          {slip.advances.length === 0 ? (
            <p className="text-sm text-muted-foreground">No advances to recover.</p>
          ) : (
            <div className="grid gap-1 rounded-lg border p-2">
              {slip.advances.map((a) => (
                <label key={a.id} className="flex cursor-pointer items-center gap-3 rounded px-1 py-1 text-sm hover:bg-muted/50">
                  <Checkbox checked={included.has(a.id)} onCheckedChange={() => toggleAdvance(a.id)} aria-label={`Deduct the ${a.date} advance`} />
                  <span className="w-24 shrink-0 text-muted-foreground tabular-nums">{fmtDate(a.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{PAYMENT_TYPE_LABELS[a.type]}{a.note ? ` · ${a.note}` : ""}</span>
                  <span className="shrink-0 font-medium tabular-nums">{money(a.amount)}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ps-note">Note (optional, printed)</Label>
          <Input id="ps-note" value={note} maxLength={300} onChange={(e) => { setNote(e.target.value); touch(); }} />
        </div>
      </Card>

      <Card className="h-fit p-5 space-y-3 text-sm lg:sticky lg:top-24">
        <h2 className="text-base font-semibold">Summary</h2>
        <Row label="Wage" value={money(slip.basic_salary)} />
        {lines.filter((l) => l.kind === "earning" && Number(l.amount) > 0).map((l, i) => (
          <Row key={`e${i}`} label={l.label || "Earning"} value={`+${money(Number(l.amount))}`} />
        ))}
        <Row label="Gross pay" value={money(totals.grossPay)} strong />
        <Separator />
        {totals.absenceDeduction > 0 && (
          <Row label={`Unpaid days (${Number(unpaidDays) || 0})`} value={`−${money(totals.absenceDeduction)}`} />
        )}
        {lines.filter((l) => l.kind === "deduction" && Number(l.amount) > 0).map((l, i) => (
          <Row key={`d${i}`} label={l.label || "Deduction"} value={`−${money(Number(l.amount))}`} />
        ))}
        {totals.advanceDeduction > 0 && <Row label="Advances" value={`−${money(totals.advanceDeduction)}`} />}
        <Row label="Total deductions" value={`−${money(totals.totalDeductions)}`} strong />
        <Separator />
        <div className="flex items-baseline justify-between">
          <span className="font-medium">Net pay</span>
          <span className={`text-2xl font-bold tabular-nums ${totals.netPay < 0 ? "text-destructive" : ""}`}>{money(totals.netPay)}</span>
        </div>
        {totals.netPay < 0 && <p className="text-xs text-destructive">Deductions exceed pay — carry an advance forward.</p>}
        <div className="grid gap-2 pt-2">
          <Button variant="outline" onClick={() => void save().then((ok) => ok && toast.success("Draft saved"))} disabled={disabled || !dirty}>
            {saving ? "Saving…" : dirty ? "Save draft" : "Saved"}
          </Button>
          <Button onClick={() => setConfirmFinalize(true)} disabled={disabled || totals.netPay < 0}>
            <Lock className="size-4 me-1" /> Finalize payslip
          </Button>
          <Button variant="ghost" className="text-destructive" onClick={onDiscard} disabled={disabled}>
            <Trash2 className="size-4 me-1" /> Discard draft
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmFinalize}
        onOpenChange={setConfirmFinalize}
        title="Finalize this payslip?"
        description={`Net pay of ${money(totals.netPay)} is locked in. After this nothing on the payslip can be changed — it can only be paid.`}
        confirmLabel="Finalize"
        busy={disabled}
        onConfirm={() => {
          setConfirmFinalize(false);
          void saveAndFinalize();
        }}
      />
    </div>
  );
}

function LineSection({
  title, hint, rows, suggestions, onAdd, onUpdate, onRemove,
}: {
  title: string;
  hint: string;
  rows: Array<{ l: Line; i: number }>;
  suggestions: string[];
  onAdd: (label?: string) => void;
  onUpdate: (i: number, patch: Partial<Line>) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <Button key={s} type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onAdd(s)}>
              <Plus className="size-3 me-0.5" /> {s}
            </Button>
          ))}
        </div>
      </div>
      {rows.map(({ l, i }) => (
        <div key={i} className="flex items-center gap-2">
          <Input aria-label={`${title} name`} value={l.label} maxLength={60} placeholder="Name" className="h-9 min-w-0 flex-1"
            onChange={(e) => onUpdate(i, { label: e.target.value })} />
          <Input aria-label={`${title} amount`} type="number" step="any" min={0} inputMode="decimal" placeholder="Amount" className="h-9 w-32"
            value={l.amount} onChange={(e) => onUpdate(i, { amount: e.target.value })} />
          <Button type="button" size="icon" variant="ghost" onClick={() => onRemove(i)} title="Remove">
            <X className="size-4" />
          </Button>
        </div>
      ))}
      {rows.length === 0 && (
        <button type="button" className="w-fit text-xs text-muted-foreground underline" onClick={() => onAdd()}>
          Add a custom line
        </button>
      )}
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className={`min-w-0 truncate ${strong ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
      <span className={`shrink-0 tabular-nums ${strong ? "font-semibold" : "font-medium"}`}>{value}</span>
    </div>
  );
}

// ─── Locked, printable payslip ───────────────────────────────────────────────

function PayslipView({ slip, shopName, currency }: { slip: PayslipDetailDto; shopName: string; currency: string }) {
  const formatMoney = useFormatMoney();
  const money = (n: number) => formatMoney(n, currency);
  const earnings = slip.lines.filter((l) => l.kind === "earning");
  const deductions = slip.lines.filter((l) => l.kind === "deduction");
  const advances = slip.advances.filter((a) => a.included);

  return (
    // #report-print-area: the print stylesheet hides everything else, so the
    // Print button yields just the slip.
    <div id="report-print-area" className="mx-auto w-full max-w-md">
      <Card className="p-6 space-y-4 print:border-0 print:shadow-none">
        <div className="text-center">
          <p className="text-lg font-bold">{shopName}</p>
          <p className="text-sm text-muted-foreground">Payslip · {slip.period_label}</p>
          <p className="text-xs text-muted-foreground">{fmtDate(slip.period_start)} – {fmtDate(slip.period_end)}</p>
          <div className="mt-2 flex justify-center"><PayslipStatusBadge status={slip.status} /></div>
        </div>
        <Separator />
        <div className="grid grid-cols-1 gap-1 text-sm">
          <Row label="Employee" value={slip.employee.name} />
          {slip.employee.phone && <Row label="Phone" value={slip.employee.phone} />}
          {slip.unpaid_days > 0 && (
            <Row label="Days worked" value={`${slip.days_in_period - slip.unpaid_days} of ${slip.days_in_period}`} />
          )}
        </div>
        <Separator />
        <div className="grid grid-cols-1 gap-1 text-sm">
          <p className="text-xs font-medium uppercase text-muted-foreground">Earnings</p>
          <Row label="Wage" value={money(slip.basic_salary)} />
          {earnings.map((l) => <Row key={l.id} label={l.label} value={money(l.amount)} />)}
          <div className="border-t pt-1"><Row label="Gross pay" value={money(slip.gross_pay)} strong /></div>
        </div>
        <div className="grid grid-cols-1 gap-1 text-sm">
          <p className="text-xs font-medium uppercase text-muted-foreground">Deductions</p>
          {slip.total_deductions === 0 ? (
            <p className="text-muted-foreground">None.</p>
          ) : (
            <>
              {slip.absence_deduction > 0 && <Row label={`Unpaid days (${slip.unpaid_days})`} value={`−${money(slip.absence_deduction)}`} />}
              {deductions.map((l) => <Row key={l.id} label={l.label} value={`−${money(l.amount)}`} />)}
              {advances.map((a) => (
                <Row key={a.id} label={`${PAYMENT_TYPE_LABELS[a.type]} · ${fmtDate(a.date)}`} value={`−${money(a.amount)}`} />
              ))}
              <div className="border-t pt-1"><Row label="Total deductions" value={`−${money(slip.total_deductions)}`} strong /></div>
            </>
          )}
        </div>
        <Separator />
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">Net pay</span>
          <span className="text-2xl font-bold tabular-nums">{money(slip.net_pay)}</span>
        </div>
        {slip.note && <p className="text-sm text-muted-foreground">{slip.note}</p>}
        <div className="grid grid-cols-1 gap-0.5 text-xs text-muted-foreground">
          {slip.finalized_at && (
            <p>Finalized {fmtDate(slip.finalized_at.slice(0, 10))}{slip.finalized_by_name ? ` by ${slip.finalized_by_name}` : ""}</p>
          )}
          {slip.paid_on && <p>Paid on {fmtDate(slip.paid_on)}</p>}
        </div>
      </Card>
    </div>
  );
}
