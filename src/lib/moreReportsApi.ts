/**
 * The terminal's data source for components/reports/MoreReports: the web's own
 * report actions, over RPC. These figures (assets, payroll, cash & bank,
 * cheques, collection, product flow) live on the server, so the tabs need a connection — the shared
 * component shows the error in the tab when there isn't one.
 */
import { rpc } from "@/lib/apiClient";
import type {
  AccountsReport,
  AssetReportRow,
  ChequeReportRow,
  CollectionRow,
  FlowProductOption,
  MoreReportsApi,
  PayrollReport,
  ProductFlow,
  ReturnReportRow,
} from "@/lib/more-reports";

// ⚠️ rpc() is variadic: each argument is passed on its own, never as an array.
export const moreReportsApi: MoreReportsApi = {
  assets: (fromDate, toDate) => rpc<AssetReportRow[]>("assetsReportAction", fromDate, toDate),
  payroll: (fromDate, toDate) => rpc<PayrollReport>("payrollReportAction", fromDate, toDate),
  returns: (fromISO, toISO) => rpc<ReturnReportRow[]>("returnsReportAction", fromISO, toISO),
  accounts: (fromDate, toDate) => rpc<AccountsReport>("accountsReportAction", fromDate, toDate),
  cheques: (fromDate, toDate) => rpc<ChequeReportRow[]>("chequesReportAction", fromDate, toDate),
  collection: (fromDate, toDate) => rpc<CollectionRow[]>("collectionReportAction", fromDate, toDate),
  flowProducts: () => rpc<FlowProductOption[]>("flowProductsAction"),
  productFlow: (productId, variantId, fromISO, toISO) => rpc<ProductFlow>("productFlowAction", productId, variantId, fromISO, toISO),
  // Category / Brand filters; offline they come back empty and the filters hide.
  catalog: async () => {
    const [categories, brands] = await Promise.all([
      rpc<{ id: string; name: string; parent_id: string | null }[]>("listCategoriesAction").catch(() => []),
      rpc<{ id: string; name: string }[]>("listBrandsAction").catch(() => []),
    ]);
    return { categories: categories ?? [], brands: brands ?? [] };
  },
};
