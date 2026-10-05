"use client";

/**
 * The payroll dialogs: add/edit an employee, give an advance, pay payslips.
 * ⚠️ COPIED verbatim to the desktop app (`src/components/payroll/`).
 */
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccountPicker } from "@/components/AccountPicker";
import { DateInput } from "@/components/DateInput";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { cn } from "@/lib/utils";
import { PAYSLIP_STATUS_LABELS, type EmployeeDto, type PayslipStatus } from "@/lib/payroll";
import { failure } from "@/lib/payroll";
import { SALARY_PERIODS, SALARY_PERIOD_LABELS, salaryAmountLabel, todayISO, type SalaryPeriod } from "@/lib/salary-period";
import { payrollApi } from "@/components/payroll/payroll-api";

const STATUS_CLASS: Record<PayslipStatus, string> = {
  draft: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  finalized: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  paid: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

export function PayslipStatusBadge({ status }: { status: PayslipStatus }) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASS[status])}>
      {PAYSLIP_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Anchoring a daily cycle means nothing — every day is its own period. */
function anchorHelp(period: SalaryPeriod): string | null {
  switch (period) {
    case "daily":
      return null;
    case "weekly":
    case "biweekly":
      return "Leave blank for weeks starting on Monday.";
    case "custom":
      return "Leave blank to count from Monday, 5 January 1970.";
    default:
      return "Leave blank for calendar periods starting on the 1st.";
  }
}

const NONE = "__none__";

// ─── Employee ────────────────────────────────────────────────────────────────

export function EmployeeDialog({
  open,
  onOpenChange,
  employee,
  prefill,
  team,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing this employee; absent = adding one. */
  employee?: EmployeeDto;
  /** Adding from the team: the login to link and its name. */
  prefill?: { user_id: string; name: string };
  /** Staff logins not yet linked to an employee. */
  team: Array<{ user_id: string; name: string }>;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && (
          <EmployeeForm
            employee={employee}
            prefill={prefill}
            team={team}
            onDone={(saved) => {
              onOpenChange(false);
              if (saved) onSaved();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EmployeeForm({
  employee,
  prefill,
  team,
  onDone,
}: {
  employee?: EmployeeDto;
  prefill?: { user_id: string; name: string };
  team: Array<{ user_id: string; name: string }>;
  onDone: (saved: boolean) => void;
}) {
  const [name, setName] = useState(employee?.name ?? prefill?.name ?? "");
  const [phone, setPhone] = useState(employee?.phone ?? "");
  const [userId, setUserId] = useState<string>(employee?.user_id ?? prefill?.user_id ?? "");
  const [amount, setAmount] = useState(employee ? String(employee.salary_amount) : "");
  const [period, setPeriod] = useState<SalaryPeriod>(employee?.salary_period ?? "monthly");
  const [days, setDays] = useState(employee?.salary_period_days ? String(employee.salary_period_days) : "30");
  const [anchor, setAnchor] = useState(employee?.salary_anchor ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The current link stays pickable while editing, beside the unlinked logins.
  const logins = [
    ...(employee?.user_id ? [{ user_id: employee.user_id, name: employee.user_name ?? "Linked login" }] : []),
    ...team,
  ];

  const save = async () => {
    const amt = Number(amount);
    if (name.trim().length < 2) return setError("Enter a name.");
    if (!Number.isFinite(amt) || amt < 0) return setError("Enter the wage (0 or more).");
    setSaving(true);
    setError(null);
    const res = await payrollApi
      .saveEmployee({
        id: employee?.id ?? null,
        name: name.trim(),
        phone: phone.trim() || null,
        user_id: userId || null,
        salary_amount: amt,
        salary_period: period,
        salary_period_days: period === "custom" ? Math.max(1, Math.floor(Number(days) || 1)) : null,
        salary_anchor: period === "daily" ? null : anchor || null,
      })
      .catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed to save" }));
    setSaving(false);
    if (failure(res)) return setError(failure(res)!);
    toast.success(employee ? "Employee updated" : "Employee added");
    onDone(true);
  };

  const help = anchorHelp(period);
  return (
    <>
      <DialogHeader>
        <DialogTitle>{employee ? `Edit ${employee.name}` : "Add employee"}</DialogTitle>
        <DialogDescription>
          Anyone you pay — they don&apos;t need a login. Payslips keep the wage they were made with.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="emp-name">Name</Label>
          <Input id="emp-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={80} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="emp-phone">Phone (optional)</Label>
          <Input id="emp-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
        </div>
        <div className="space-y-1.5">
          <Label>Staff login (optional)</Label>
          <Select value={userId || NONE} onValueChange={(v) => setUserId(v === NONE ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No login</SelectItem>
              {logins.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Paid</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as SalaryPeriod)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SALARY_PERIODS.map((p) => (
                <SelectItem key={p} value={p}>{SALARY_PERIOD_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="emp-amount">{salaryAmountLabel(period, Number(days) || null)}</Label>
          <Input id="emp-amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        {period === "custom" && (
          <div className="space-y-1.5">
            <Label htmlFor="emp-days">Days in a period</Label>
            <Input id="emp-days" type="number" min="1" max="3650" step="1" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
        )}
        {period !== "daily" && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Periods start on (optional)</Label>
            <DateInput value={anchor} onChange={(e) => setAnchor(e.target.value)} />
            {help && <p className="text-xs text-muted-foreground">{help}</p>}
          </div>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={() => onDone(false)} disabled={saving}>Cancel</Button>
        <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : employee ? "Save" : "Add employee"}</Button>
      </DialogFooter>
    </>
  );
}

// ─── Advance ─────────────────────────────────────────────────────────────────

export function AdvanceDialog({
  open,
  onOpenChange,
  employees,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: EmployeeDto[];
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <AdvanceForm
            employees={employees}
            onDone={(saved) => {
              onOpenChange(false);
              if (saved) onSaved();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdvanceForm({ employees, onDone }: { employees: EmployeeDto[]; onDone: (saved: boolean) => void }) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const amt = Number(amount);
    if (!employeeId) return setError("Pick an employee.");
    if (!(amt > 0)) return setError("Enter an amount above 0.");
    if (!date) return setError("Enter a date.");
    setSaving(true);
    setError(null);
    const res = await payrollApi
      .createAdvance({ employee_id: employeeId, date, amount: amt, note: note.trim() || null, account_id: accountId })
      .catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed to save" }));
    setSaving(false);
    if (failure(res)) return setError(failure(res)!);
    toast.success("Advance recorded — it comes off their next payslip");
    onDone(true);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Give advance</DialogTitle>
        <DialogDescription>Cash handed over ahead of payday. It is deducted on their next payslip.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Employee</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger><SelectValue placeholder="Pick an employee" /></SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adv-amount">Amount</Label>
          <Input id="adv-amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label>Date</Label>
          <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <AccountPicker value={accountId} onChange={setAccountId} label="Paid from" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="adv-note">Note (optional)</Label>
          <Input id="adv-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={() => onDone(false)} disabled={saving}>Cancel</Button>
        <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Give advance"}</Button>
      </DialogFooter>
    </>
  );
}

// ─── Pay ─────────────────────────────────────────────────────────────────────

/** Confirm paying one or more finalized payslips: date and source account. */
export function PayDialog({
  open,
  onOpenChange,
  payslips,
  currency,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payslips: Array<{ id: string; name: string; net_pay: number }>;
  currency: string;
  onPaid: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <PayForm
            payslips={payslips}
            currency={currency}
            onDone={(paid) => {
              onOpenChange(false);
              if (paid) onPaid();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PayForm({
  payslips,
  currency,
  onDone,
}: {
  payslips: Array<{ id: string; name: string; net_pay: number }>;
  currency: string;
  onDone: (paid: boolean) => void;
}) {
  const formatMoney = useFormatMoney();
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = payslips.reduce((s, p) => s + p.net_pay, 0);

  const pay = async () => {
    if (!date) return setError("Enter the date paid.");
    setSaving(true);
    setError(null);
    const res = await payrollApi
      .pay({ ids: payslips.map((p) => p.id), date, account_id: accountId })
      .catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed to pay" }));
    setSaving(false);
    if (failure(res)) return setError(failure(res)!);
    toast.success(payslips.length === 1 ? "Payslip paid" : `${payslips.length} payslips paid`);
    onDone(true);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{payslips.length === 1 ? `Pay ${payslips[0].name}` : `Pay ${payslips.length} payslips`}</DialogTitle>
        <DialogDescription>Records the net pay as paid out. Only the owner can undo it.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        {payslips.length > 1 && (
          <div className="grid max-h-48 gap-1 overflow-y-auto rounded-md border p-2 text-sm">
            {payslips.map((p) => (
              <div key={p.id} className="flex justify-between gap-2">
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 font-medium tabular-nums">{formatMoney(p.net_pay, currency)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Total to pay</span>
          <span className="text-2xl font-bold tabular-nums">{formatMoney(total, currency)}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Paid on</Label>
            <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <AccountPicker value={accountId} onChange={setAccountId} label="Paid from" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onDone(false)} disabled={saving}>Cancel</Button>
        <Button onClick={() => void pay()} disabled={saving || !date}>{saving ? "Paying…" : "Mark as paid"}</Button>
      </DialogFooter>
    </>
  );
}
