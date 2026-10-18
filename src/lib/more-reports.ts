/**
 * The Reports page's server-side reports — assets, payroll, returns, cash &
 * bank, cheques. Their figures live only on the server (or are cheaper to
 * total there), so the web calls the actions in reports/actions.ts directly
 * and the terminal calls the very same actions over RPC.
 *
 * Types only. ⚠️ COPIED verbatim to the desktop, like
 * components/reports/MoreReports.tsx which renders them.
 */

export interface AssetReportRow {
  id: string;
  name: string;
  category: string | null;
  purchase_date: string;
  cost: number;
  salvage_value: number;
  useful_life_months: number;
  status: string;
  disposed_at: string | null;
  disposal_amount: number | null;
  /** Straight-line charge per month of its life. */
  monthly: number;
  /** Depreciation charged inside the period. */
  depreciation: number;
  /** Charged from purchase up to the end of the period. */
  accumulated: number;
  /** Cost less accumulated, at the end of the period (0 once it has left). */
  book_value: number;
  /** Profit (+) or loss (−) on a sale / write-off inside the period. */
  gain: number | null;
  bought_in_period: boolean;
}

export interface PayrollReportPayment {
  id: string;
  date: string;
  employee: string;
  type: "advance" | "salary" | "bonus";
  amount: number;
  account: string | null;
  note: string | null;
}

export interface PayrollReportEmployee {
  key: string;
  name: string;
  is_active: boolean;
  salary_amount: number;
  salary_period: string | null;
  salary: number;
  advance: number;
  bonus: number;
  total: number;
  /** Payslips whose pay period overlaps the dates: their net pay. */
  payslips: number;
  payslips_net: number;
  /** Finalized payslips not yet paid out. */
  awaiting: number;
}

export interface PayrollReport {
  employees: PayrollReportEmployee[];
  payments: PayrollReportPayment[];
}

export interface ReturnReportRow {
  id: string;
  kind: "customer" | "supplier";
  number: string | null;
  date: string;
  party: string | null;
  /** The bill (customer) or purchase reference (supplier) it was against. */
  against: string | null;
  lines: number;
  quantity: number;
  deduction: number;
  amount: number;
  to_ledger: boolean;
  account: string | null;
  reason: string | null;
}

export interface AccountReportRow {
  id: string;
  name: string;
  type: string;
  is_archived: boolean;
  opening: number;
  money_in: number;
  money_out: number;
  closing: number;
}

export interface AccountKindRow {
  kind: string;
  money_in: number;
  money_out: number;
}

export interface AccountsReport {
  accounts: AccountReportRow[];
  by_kind: AccountKindRow[];
}

export interface ChequeReportRow {
  id: string;
  number: string;
  bank: string | null;
  party: string;
  direction: "received" | "issued";
  amount: number;
  cheque_date: string;
  status: "pending" | "cleared" | "bounced";
  /** yyyy-mm-dd it cleared or bounced, if it has. */
  settled_on: string | null;
}

export interface MoreReportsApi {
  assets: (fromDate: string, toDate: string) => Promise<AssetReportRow[]>;
  payroll: (fromDate: string, toDate: string) => Promise<PayrollReport>;
  returns: (fromISO: string, toISO: string) => Promise<ReturnReportRow[]>;
  accounts: (fromDate: string, toDate: string) => Promise<AccountsReport>;
  cheques: (fromDate: string, toDate: string) => Promise<ChequeReportRow[]>;
}

/** Money-account movement kinds, in the shop's words. */
export const ACCOUNT_KIND_LABELS: Record<string, string> = {
  deposit: "Deposits",
  withdrawal: "Withdrawals",
  transfer: "Transfers",
  adjustment: "Adjustments",
  sale: "Sales",
  purchase: "Purchases",
  expense: "Expenses",
  payroll: "Salaries",
  refund: "Refunds",
  debt: "Ledger payments",
  asset: "Assets",
  zakat: "Zakat",
};
