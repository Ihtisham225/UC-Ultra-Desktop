/**
 * The terminal's data source for components/reports/MoreReports: the web's own
 * report actions, over RPC. These figures (assets, payroll, cash & bank,
 * cheques) live on the server, so the tabs need a connection — the shared
 * component shows the error in the tab when there isn't one.
 */
import { rpc } from "@/lib/apiClient";
import type {
  AccountsReport,
  AssetReportRow,
  ChequeReportRow,
  MoreReportsApi,
  PayrollReport,
  ReturnReportRow,
} from "@/lib/more-reports";

// ⚠️ rpc() is variadic: each argument is passed on its own, never as an array.
export const moreReportsApi: MoreReportsApi = {
  assets: (fromDate, toDate) => rpc<AssetReportRow[]>("assetsReportAction", fromDate, toDate),
  payroll: (fromDate, toDate) => rpc<PayrollReport>("payrollReportAction", fromDate, toDate),
  returns: (fromISO, toISO) => rpc<ReturnReportRow[]>("returnsReportAction", fromISO, toISO),
  accounts: (fromDate, toDate) => rpc<AccountsReport>("accountsReportAction", fromDate, toDate),
  cheques: (fromDate, toDate) => rpc<ChequeReportRow[]>("chequesReportAction", fromDate, toDate),
};
