/**
 * Payroll — the shapes and sums shared by the server, the web screens and the
 * desktop's. Modelled on the daily-cup payroll: each pay period an employee
 * gets a payslip that is generated as a DRAFT (wage in, advances deducted),
 * adjusted (earnings, deductions, unpaid days), FINALIZED (locked) and then
 * PAID. Periods follow each employee's own cycle — see `salary-period.ts`.
 *
 * Pure (no Prisma, no React), so the desktop can hold a verbatim copy.
 * ⚠️ COPIED to the desktop app (`src/lib/payroll.ts`) — keep the two in step.
 */
import type { SalaryPeriod } from "@/lib/salary-period";

export type PaymentType = "advance" | "salary" | "bonus";
export type PayslipStatus = "draft" | "finalized" | "paid";
export type PayslipLineKind = "earning" | "deduction";

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  advance: "Advance",
  salary: "Salary",
  bonus: "Bonus",
};

export const PAYSLIP_STATUS_LABELS: Record<PayslipStatus, string> = {
  draft: "Draft",
  finalized: "Finalized",
  paid: "Paid",
};

export const EARNING_SUGGESTIONS = ["Bonus", "Overtime", "Allowance", "Commission"];
export const DEDUCTION_SUGGESTIONS = ["Fine", "Loan instalment", "Damage", "Other"];

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The payslip sums, shared by the server (which stores them) and the draft
 * editor (which previews them while you type), so the two always agree.
 *
 *   gross           = basic + Σ earnings
 *   absence         = basic ÷ days in the period × unpaid days
 *   totalDeductions = absence + Σ deductions + advances recovered
 *   net             = gross − totalDeductions
 */
export function computePayslip(input: {
  basicSalary: number;
  daysInPeriod: number;
  unpaidDays: number;
  lines: Array<{ kind: PayslipLineKind; amount: number }>;
  advances: number;
}) {
  const earnings = input.lines.filter((l) => l.kind === "earning").reduce((s, l) => s + l.amount, 0);
  const deductions = input.lines.filter((l) => l.kind === "deduction").reduce((s, l) => s + l.amount, 0);
  const absenceDeduction = r2(
    input.daysInPeriod > 0 ? (input.basicSalary / input.daysInPeriod) * input.unpaidDays : 0,
  );
  const grossPay = r2(input.basicSalary + earnings);
  const advanceDeduction = r2(input.advances);
  const totalDeductions = r2(absenceDeduction + deductions + advanceDeduction);
  return { grossPay, absenceDeduction, advanceDeduction, totalDeductions, netPay: r2(grossPay - totalDeductions) };
}

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface EmployeeDto {
  id: string;
  name: string;
  phone: string | null;
  /** The staff login this employee is, when linked. */
  user_id: string | null;
  user_name: string | null;
  salary_amount: number;
  salary_period: SalaryPeriod;
  salary_period_days: number | null;
  salary_anchor: string | null;
  is_active: boolean;
}

export interface PayrollPaymentDto {
  id: string;
  date: string;
  type: PaymentType;
  amount: number;
  note: string | null;
}

export interface PayslipSummaryDto {
  id: string;
  status: PayslipStatus;
  period_start: string;
  period_end: string;
  period_label: string;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  paid_on: string | null;
}

/** One row of the payroll screen: an employee and the period containing the chosen day. */
export interface PayrollRowDto {
  employee: EmployeeDto;
  period_start: string;
  period_end: string;
  period_label: string;
  /** Null until a payslip is generated for that period. */
  payslip: PayslipSummaryDto | null;
  /** Advances a payslip for this period would deduct. */
  pending_advances: number;
}

export interface PayrollPaymentRowDto extends PayrollPaymentDto {
  employee_name: string;
  /** Set on a payout: the payslip it paid. */
  payslip_id: string | null;
  payslip_label: string | null;
  /** Set on an advance: the payslip that deducted it. */
  recovered_on_id: string | null;
  recovered_on_label: string | null;
  /** Its payslip is locked, so the payment can't be removed on its own. */
  locked: boolean;
}

export interface PayrollOverviewDto {
  on: string;
  rows: PayrollRowDto[];
  employees: EmployeeDto[];
  payments: PayrollPaymentRowDto[];
  /** Staff logins not yet on the employee list, for "Add from team". */
  team: Array<{ user_id: string; name: string }>;
}

export interface PayslipLineDto {
  id: string;
  kind: PayslipLineKind;
  label: string;
  amount: number;
}

export interface RecoverableDto extends PayrollPaymentDto {
  /** Deducted on this payslip (true) or left to carry forward. */
  included: boolean;
}

export interface PayslipDetailDto {
  id: string;
  status: PayslipStatus;
  period_start: string;
  period_end: string;
  period_label: string;
  employee: { id: string; name: string; phone: string | null };
  basic_salary: number;
  days_in_period: number;
  unpaid_days: number;
  absence_deduction: number;
  advance_deduction: number;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  note: string | null;
  lines: PayslipLineDto[];
  /** Deducted advances; on a draft, also the ones it could still take. */
  advances: RecoverableDto[];
  created_at: string;
  finalized_at: string | null;
  finalized_by_name: string | null;
  paid_on: string | null;
  payouts: PayrollPaymentDto[];
  /** The employee's wage now — differs from basic_salary if it changed. */
  current_salary: number;
}

export interface EmployeeHistoryDto {
  employee: EmployeeDto;
  payslips: PayslipSummaryDto[];
  payments: Array<PayrollPaymentDto & { payslip_label: string | null }>;
}

export type PayrollResult = { ok: true } | { ok: false; error: string };

/**
 * The error of a failed result, or null when it succeeded. The desktop
 * compiles with `strict: false`, where TypeScript won't narrow
 * `{ ok: true } | { ok: false; error }` on `ok` — reading the error through
 * here keeps the shared screens compiling in both apps.
 */
export function failure(r: { ok: boolean }): string | null {
  return r.ok ? null : ((r as { error?: string }).error ?? "Something went wrong");
}
