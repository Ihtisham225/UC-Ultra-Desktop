/**
 * How the shared payroll screens reach the server. The screens in this folder
 * are COPIED verbatim from the web app; only this file differs — there it
 * calls the server actions directly, here it goes over `rpc()`.
 *
 * ⚠️ `rpc` is variadic: each argument is passed as its own parameter, never
 * wrapped in an array.
 */
import { rpc } from "@/lib/apiClient";
import type {
  EmployeeHistoryDto,
  PayrollOverviewDto,
  PayrollResult,
  PayslipDetailDto,
  PayslipLineKind,
} from "@/lib/payroll";
import type { SalaryPeriod } from "@/lib/salary-period";

export const payrollApi = {
  overview: (on?: string) => rpc<PayrollOverviewDto>("getPayrollOverviewAction", on),
  saveEmployee: (input: {
    id?: string | null;
    name: string;
    phone?: string | null;
    user_id?: string | null;
    salary_amount: number;
    salary_period: SalaryPeriod;
    salary_period_days?: number | null;
    salary_anchor?: string | null;
  }) => rpc<{ ok: true; id: string } | { ok: false; error: string }>("saveEmployeeAction", input),
  setEmployeeActive: (id: string, isActive: boolean) => rpc<PayrollResult>("setEmployeeActiveAction", id, isActive),
  employeeHistory: (id: string) => rpc<EmployeeHistoryDto | null>("getEmployeeHistoryAction", id),
  createAdvance: (input: { employee_id: string; date: string; amount: number; note?: string | null; account_id?: string | null }) =>
    rpc<PayrollResult>("createAdvanceAction", input),
  deletePayment: (id: string) => rpc<PayrollResult>("deletePayrollPaymentAction", id),
  generate: (on?: string) => rpc<{ ok: true; created: number } | { ok: false; error: string }>("generatePayslipsAction", on),
  payslip: (id: string) => rpc<PayslipDetailDto | null>("getPayslipAction", id),
  saveDraft: (input: {
    id: string;
    unpaid_days: number;
    lines: Array<{ kind: PayslipLineKind; label: string; amount: number }>;
    advance_ids: string[];
    note?: string | null;
  }) => rpc<PayrollResult>("savePayslipDraftAction", input),
  syncSalary: (id: string) => rpc<PayrollResult>("syncPayslipSalaryAction", id),
  // An array argument is still ONE parameter — passed as-is, not spread.
  finalize: (ids: string[]) => rpc<PayrollResult>("finalizePayslipsAction", ids),
  pay: (input: { ids: string[]; date: string; account_id?: string | null }) => rpc<PayrollResult>("payPayslipsAction", input),
  undoPayment: (id: string) => rpc<PayrollResult>("undoPayslipPaymentAction", id),
  deletePayslip: (id: string) => rpc<PayrollResult>("deletePayslipAction", id),
};
