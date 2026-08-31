import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShop } from "@/contexts/ShopContext";
import { Card } from "@/components/ui/card";
import { Plus, Receipt as ReceiptIcon, ChevronRight, Eye, Undo2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { format } from "date-fns";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import { rpc } from "@/lib/apiClient";
import { ReturnDialog } from "@/components/ReturnDialog";
import { useConfirm } from "@/components/ConfirmDialog";
import { Pagination } from "@/components/Pagination";
import { useRowSelection } from "@/hooks/useRowSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { downloadCsv } from "@/lib/csv";
import { toast } from "sonner";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useLocalStore } from "@/hooks/useLocalStore";
import { deleteLocal, notifyChange } from "@/lib/localDb";
import { ManualSaleDialog, type ManualSaleApi } from "@/components/ManualSaleDialog";
import { soldAs, formatSoldQuantity } from "@/lib/sale-units";

/**
 * "Engine Oil 20W-50 ×2 Bottle (4 L)" — how the counter rang it up, not the
 * eight litres it is stored as. A quantity of one is left off: "Oil Filter"
 * reads better than "Oil Filter ×1".
 */
const lineSummary = (it: Sale["sale_items"][number]) => {
  const sold = soldAs({ ...it, quantity: Number(it.quantity), unit_price: 0 });
  if (sold.quantity === 1 && !sold.unit) return it.product_name;
  return `${it.product_name} \u00d7${formatSoldQuantity(sold)}`;
};

const PAGE_SIZE_KEY = "pos.pageSize.sales";
const DEFAULT_PAGE_SIZE = 20;

type ReturnStatus = "none" | "partial" | "full";

interface Sale {
  id: string;
  receipt_number: string | null;
  total: number;
  payment_method: string;
  payments?: { account_name: string; amount: number }[];
  balance_due?: number;
  created_at: string;
  sale_items: {
    id: string;
    product_name: string;
    quantity: number;
    /** Set when the line was billed in a unit other than the product's own. */
    unit_label?: string | null;
    unit_factor?: number | null;
  }[];
  returnStatus: ReturnStatus;
}

/**
 * Back-dated entry goes straight to the server rather than the offline queue:
 * it is an office task, not a till one, and reusing the online checkout keeps
 * stock, debt and account balances on a single code path.
 */
const manualSaleApi: ManualSaleApi = {
  products: async () => {
    const rows = await rpc<Array<{ id: string; name: string; price: number; barcode: string | null }>>("loadPosProductsAction");
    return rows.map((p) => ({ id: p.id, name: p.name, price: Number(p.price), barcode: p.barcode }));
  },
  accounts: () => rpc("listAccountOptionsAction"),
  submit: (input) => rpc("completeSaleAction", input),
};

export default function Sales() {
  const [manualOpen, setManualOpen] = useState(false);
  usePageMeta({ title: "Sales History — UCU", description: "Browse past sales, view receipts, filter by date and export to CSV.", path: "/sales" });
  const { t } = useTranslation();
  const { currentShop, role } = useShop();
  const formatMoney = useFormatMoney();
  const canReturn = role === "owner" || role === "manager";
  const canDelete = role === "owner";
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState<number>(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(PAGE_SIZE_KEY) : null;
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_PAGE_SIZE;
  });
  const setPageSize = (n: number) => {
    setPageSizeState(n);
    setPage(1);
    try { localStorage.setItem(PAGE_SIZE_KEY, String(n)); } catch {}
  };
  const [openSale, setOpenSale] = useState<any>(null);
  const [returnSaleId, setReturnSaleId] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const sel = useRowSelection();

  useEffect(() => { document.title = "UCU"; }, []);

  const { data: allSalesRaw, loading, refresh: loadSales } = useLocalStore<any>("sales", currentShop?.id);
  const { data: allSaleItems } = useLocalStore<any>("sale_items", currentShop?.id);
  const { data: allOilChanges } = useLocalStore<any>("oil_changes", currentShop?.id);
  const { data: allReturns } = useLocalStore<any>("sale_returns", currentShop?.id);
  // A cached sale row only has the legacy single payment_method, so the tender
  // lines (and the account names) are joined on from their own tables.
  const { data: allPayments } = useLocalStore<any>("sale_payments", currentShop?.id);
  const { data: allAccounts } = useLocalStore<any>("money_accounts", currentShop?.id);

  // Sort and paginate locally
  const allSales = useMemo(() => {
    return [...allSalesRaw].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ).map((s) => {
      const items = allSaleItems.filter((i: any) => i.sale_id === s.id);
      const totalQty = items.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0);
      const saleReturns = allReturns.filter((r: any) => r.sale_id === s.id);
      const returnedQty = saleReturns.reduce((sum: number, r: any) => sum + Number(r.quantity || 0), 0);
      let returnStatus: ReturnStatus = "none";
      if (returnedQty > 0) returnStatus = returnedQty >= totalQty ? "full" : "partial";
      const payments = allPayments
        .filter((p: any) => p.sale_id === s.id)
        .map((p: any) => ({
          account_name: allAccounts.find((a: any) => a.id === p.account_id)?.name ?? "Unassigned",
          amount: Number(p.amount) || 0,
        }));
      const balance_due = Math.max(
        0,
        Math.round((Number(s.total ?? 0) - Number(s.amount_paid ?? 0)) * 100) / 100,
      );
      return { ...s, sale_items: items, returnStatus, payments, balance_due };
    });
  }, [allSalesRaw, allSaleItems, allReturns, allPayments, allAccounts]);

  const totalCount = allSales.length;
  const grandTotal = allSalesRaw.reduce((a: number, s: any) => a + Number(s.total ?? 0), 0);
  const grandRefunded = allReturns.reduce((a: number, r: any) => a + Number(r.total_refund ?? 0), 0);

  const sales = useMemo(() => {
    const offset = (page - 1) * pageSize;
    return allSales.slice(offset, offset + pageSize);
  }, [allSales, page, pageSize]);

  // Clamp page if totals shrink (e.g. after deletes).
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [totalCount, pageSize, page]);

  const cur = currentShop?.currency ?? "USD";

  const openReceipt = (saleId: string) => {
    if (!currentShop) return;
    const sale = allSales.find((s) => s.id === saleId);
    if (sale) {
      setOpenSale({ ...sale, items: sale.sale_items, customer: null, shop: currentShop });
      // The vehicle record is its own synced row, so the reprint has to look
      // it up — it prints the plate and the next-due reading.
      const oil = allOilChanges.find((o: { sale_id?: string | null }) => o.sale_id === saleId);
      if (oil) setOpenSale((prev: any) => (prev && prev.id === saleId ? { ...prev, oil_change: oil } : prev));
      // Patient details ride along on the local sale row, but the lab tokens
      // only exist server-side — fetch them so a reprint matches the original.
      if (sale.patient_id && navigator.onLine) {
        rpc<{ id: string; token_number: string; test_name: string }[]>("listLabOrdersForSaleAction", saleId)
          .then((orders) => setOpenSale((prev: any) => (prev && prev.id === saleId ? { ...prev, lab_orders: orders } : prev)))
          .catch(() => { /* offline — the receipt still prints without tokens */ });
      }
    }
  };

  const deleteSale = async (saleId: string) => {
    const ok = await confirm({
      title: t("sales.deleteSale"),
      description: t("sales.deleteConfirm"),
      variant: "destructive",
    });
    if (!ok) return;
    const saleItems = allSaleItems.filter((i: any) => i.sale_id === saleId);
    for (const item of saleItems) await deleteLocal("sale_items", item.id, true);
    await deleteLocal("sales", saleId, true);
    notifyChange("sales");
    toast.success(t("common.deleted"));
  };

  const visibleIds = sales.map((s) => s.id);

  const bulkDelete = async () => {
    if (sel.count === 0) return;
    const ok = await confirm({
      title: t("bulk.deleteTitle"),
      description: t("bulk.deleteConfirm", { count: sel.count }),
      variant: "destructive",
    });
    if (!ok) return;
    const ids = sel.ids;
    for (const id of ids) {
      const saleItems = allSaleItems.filter((i: any) => i.sale_id === id);
      for (const item of saleItems) await deleteLocal("sale_items", item.id, true);
      await deleteLocal("sales", id, true);
    }
    notifyChange("sales");
    toast.success(t("bulk.deleted", { count: ids.length }));
    sel.clear();
  };

  const bulkExport = () => {
    const rows = sales.filter((s) => sel.has(s.id));
    if (rows.length === 0) return toast.error(t("bulk.nothingExported"));
    downloadCsv(`sales-${new Date().toISOString().slice(0, 10)}`, rows, [
      { header: "Receipt", value: (r) => r.receipt_number ?? "" },
      { header: "Date", value: (r) => format(new Date(r.created_at), "yyyy-MM-dd HH:mm") },
      { header: "Items", value: (r) => r.sale_items.length },
      { header: "Payment", value: (r) => (r.payments?.length ? r.payments.map((p) => `${p.account_name} ${p.amount}`).join(" | ") : r.payment_method) },
      { header: "Balance due", value: (r) => ((r.balance_due ?? 0) > 0 ? (r.balance_due ?? 0).toFixed(2) : "") },
      { header: "Total", value: (r) => r.total },
      { header: "Status", value: (r) => r.returnStatus },
    ]);
    toast.success(t("bulk.exported", { count: rows.length }));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("sales.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("sales.subtitle")}</p>
        </div>
        <Button onClick={() => setManualOpen(true)}>
          <Plus className="size-4 me-1" /> Record a sale
        </Button>
      </header>

      <ManualSaleDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onSaved={() => notifyChange("sales")}
        api={manualSaleApi}
      />

      <BulkActionBar
        selectedCount={sel.count}
        onClear={sel.clear}
        onExport={bulkExport}
        onDelete={canDelete ? bulkDelete : undefined}
        canDelete={canDelete}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total sales</div>
          <div className="text-lg sm:text-2xl font-bold tabular-nums mt-1 break-words leading-tight">{totalCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Gross revenue</div>
          <div className="text-lg sm:text-2xl font-bold tabular-nums mt-1 break-words leading-tight">{formatMoney(grandTotal, cur)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Net (after returns)</div>
          <div className="text-lg sm:text-2xl font-bold tabular-nums mt-1 break-words leading-tight">{formatMoney(Math.max(grandTotal - grandRefunded, 0), cur)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">refunded: {formatMoney(grandRefunded, cur)}</div>
        </Card>
      </div>

      <Card className="shadow-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">{t("common.loading")}</div>
        ) : sales.length === 0 ? (
          <div className="p-16 text-center">
            <ReceiptIcon className="size-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">{t("sales.empty")}</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-2 border-b flex items-center gap-3 bg-muted/20">
              <Checkbox
                checked={sel.allChecked(visibleIds) ? true : sel.someChecked(visibleIds) ? "indeterminate" : false}
                onCheckedChange={(v) => sel.setAll(visibleIds, !!v)}
                aria-label="select all"
              />
              <span className="text-xs text-muted-foreground">{t("common.select")}</span>
            </div>
            <ul className="divide-y">
              {sales.map((s) => (
                <li key={s.id}>
                  <div className={`w-full p-4 hover:bg-muted/40 flex items-center justify-between gap-4 text-start transition-colors ${sel.has(s.id) ? "bg-primary/5" : ""}`}>
                    <Checkbox
                      checked={sel.has(s.id)}
                      onCheckedChange={(v) => sel.toggle(s.id, !!v)}
                      aria-label={`select ${s.receipt_number}`}
                    />
                    <button onClick={() => openReceipt(s.id)} className="min-w-0 flex-1 text-start">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold font-mono text-sm">{s.receipt_number}</span>
                        {s.returnStatus === "full" && (
                          <Badge variant="destructive" className="gap-1 text-[10px] uppercase tracking-wide">
                            <Undo2 className="size-3" /> {t("sales.fullyReturned")}
                          </Badge>
                        )}
                        {s.returnStatus === "partial" && (
                          <Badge className="gap-1 text-[10px] uppercase tracking-wide bg-warning/15 text-warning border-warning/30 hover:bg-warning/20">
                            <Undo2 className="size-3" /> {t("sales.partiallyReturned")}
                          </Badge>
                        )}
                      </div>
                      {s.sale_items.length > 0 && (
                        <div className="text-xs text-foreground/80 mt-0.5 truncate">
                          {s.sale_items.map(lineSummary).join(", ")}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(s.created_at), "PPp")} · {t("sales.itemsCount", { count: s.sale_items.length })} ·{" "}
                        {s.payments?.length
                          ? s.payments.map((p) => `${p.account_name} ${formatMoney(p.amount, cur)}`).join(" · ")
                          : s.payment_method}
                        {(s.balance_due ?? 0) > 0 && (
                          <span className="text-warning font-medium"> · {formatMoney(s.balance_due ?? 0, cur)} due</span>
                        )}
                      </div>
                    </button>
                    <div className={`text-lg font-bold tabular-nums ${s.returnStatus === "full" ? "line-through text-muted-foreground" : ""}`}>
                      {formatMoney(s.total, cur)}
                    </div>
                    <Button variant="ghost" size="icon" title={t("sales.viewReceipt")} onClick={() => openReceipt(s.id)}>
                      <Eye className="size-4" />
                    </Button>
                    {canReturn && s.returnStatus !== "full" && (
                      <Button variant="ghost" size="icon" title={t("sales.processReturn")} onClick={() => setReturnSaleId(s.id)}>
                        <Undo2 className="size-4 text-warning" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="icon" title={t("sales.deleteSale")} onClick={() => deleteSale(s.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                    <ChevronRight className="size-4 text-muted-foreground rtl-flip" />
                  </div>
                </li>
              ))}
            </ul>
            <Pagination
              page={page}
              pageSize={pageSize}
              totalItems={totalCount}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </Card>

      {openSale && <ReceiptDialog sale={openSale} onClose={() => setOpenSale(null)} />}
      <ReturnDialog
        open={!!returnSaleId}
        onClose={() => setReturnSaleId(null)}
        saleId={returnSaleId}
        onDone={() => loadSales()}
      />
      {confirmDialog}
    </div>
  );
}
