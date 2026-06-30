import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/contexts/ShopContext";
import { Card } from "@/components/ui/card";
import { Receipt as ReceiptIcon, ChevronRight, Eye, Undo2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { format } from "date-fns";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import { ReturnDialog } from "@/components/ReturnDialog";
import { useConfirm } from "@/components/ConfirmDialog";
import { Pagination } from "@/components/Pagination";
import { useRowSelection } from "@/hooks/useRowSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { downloadCsv } from "@/lib/csv";
import { toast } from "sonner";
import { usePageMeta } from "@/hooks/usePageMeta";
import { getCacheEntry, setCacheEntry } from "@/lib/offlineDb";

const PAGE_SIZE_KEY = "pos.pageSize.sales";
const DEFAULT_PAGE_SIZE = 20;

type ReturnStatus = "none" | "partial" | "full";

interface Sale {
  id: string;
  receipt_number: string | null;
  total: number;
  payment_method: string;
  created_at: string;
  sale_items: { id: string; product_name: string; quantity: number }[];
  returnStatus: ReturnStatus;
}

export default function Sales() {
  usePageMeta({ title: "Sales History — UCU", description: "Browse past sales, view receipts, filter by date and export to CSV.", path: "/sales" });
  const { t } = useTranslation();
  const { currentShop, role } = useShop();
  const formatMoney = useFormatMoney();
  const canReturn = role === "owner" || role === "manager";
  const canDelete = role === "owner";
  const [sales, setSales] = useState<Sale[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [grandRefunded, setGrandRefunded] = useState(0);
  const [loading, setLoading] = useState(true);
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

  const loadSales = useCallback(async () => {
    if (!currentShop) return;
    setLoading(true);

    // Serve cache immediately when offline
    if (!navigator.onLine) {
      const cached = await getCacheEntry<{ sales: any[]; total: number; grandTotal: number; refundTotal: number }>(`sales:${currentShop.id}:${page}`)
      if (cached) { setSales(cached.sales); setTotalCount(cached.total); setGrandTotal(cached.grandTotal); setRefundTotal(cached.refundTotal); }
      setLoading(false);
      return;
    }
    const offset = (page - 1) * pageSize;
    const { data: salesData, count } = await supabase
      .from("sales")
      .select(
        "id, receipt_number, total, payment_method, created_at, sale_items(id, product_name, quantity)",
        { count: "exact" },
      )
      .eq("shop_id", currentShop.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const list = (salesData as any[]) ?? [];
    const ids = list.map((s) => s.id);

    const returnsBySale: Record<string, { sale_item_id: string | null; quantity: number }[]> = {};
    if (ids.length > 0) {
      const { data: returns } = await supabase
        .from("sale_returns")
        .select("sale_id, sale_return_items(sale_item_id, quantity)")
        .in("sale_id", ids);
      (returns as any[] ?? []).forEach((r) => {
        const arr = returnsBySale[r.sale_id] ?? [];
        (r.sale_return_items ?? []).forEach((it: any) => arr.push(it));
        returnsBySale[r.sale_id] = arr;
      });
    }

    const enriched = list.map((s: any) => {
      const items = s.sale_items ?? [];
      const totalQty = items.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0);
      const returnItems = returnsBySale[s.id] ?? [];
      const returnedQty = returnItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
      let returnStatus: ReturnStatus = "none";
      if (returnedQty > 0) returnStatus = returnedQty >= totalQty ? "full" : "partial";
      return { ...s, returnStatus };
    });

    setSales(enriched);
    setTotalCount(count ?? 0);

    const [{ data: allSales }, { data: allReturns }] = await Promise.all([
      supabase.from("sales").select("total").eq("shop_id", currentShop.id),
      supabase.from("sale_returns").select("total_refund").eq("shop_id", currentShop.id),
    ]);
    const grandTotal = ((allSales as any[]) ?? []).reduce((a, s) => a + Number(s.total ?? 0), 0);
    const refundTotal = ((allReturns as any[]) ?? []).reduce((a, r) => a + Number(r.total_refund ?? 0), 0);
    setGrandTotal(grandTotal);
    setGrandRefunded(refundTotal);
    setCacheEntry(`sales:${currentShop.id}:${page}`, { sales: enriched, total: count ?? 0, grandTotal, refundTotal });

    setLoading(false);
  }, [currentShop, page, pageSize]);

  useEffect(() => { loadSales(); }, [loadSales]);

  // Clamp page if totals shrink (e.g. after deletes).
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [totalCount, pageSize, page]);

  const cur = currentShop?.currency ?? "USD";

  const openReceipt = async (saleId: string) => {
    if (!currentShop) return;
    const { data } = await supabase
      .from("sales")
      .select("*, sale_items(*), customers(name, phone)")
      .eq("id", saleId)
      .maybeSingle();
    if (data) {
      setOpenSale({
        ...data,
        items: (data as any).sale_items,
        customer: (data as any).customers,
        shop: currentShop,
      });
    }
  };

  const deleteSale = async (saleId: string) => {
    const ok = await confirm({
      title: t("sales.deleteSale"),
      description: t("sales.deleteConfirm"),
      variant: "destructive",
    });
    if (!ok) return;
    const { error } = await supabase.rpc("delete_sale" as any, { _sale_id: saleId });
    if (error) return toast.error(error.message);
    toast.success(t("common.deleted"));
    loadSales();
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
    let ok_n = 0, fail = 0;
    for (const id of ids) {
      const { error } = await supabase.rpc("delete_sale" as any, { _sale_id: id });
      if (error) fail++; else ok_n++;
    }
    if (fail === 0) toast.success(t("bulk.deleted", { count: ok_n }));
    else toast.error(t("bulk.partialDelete", { ok: ok_n, total: ids.length, failed: fail }));
    sel.clear();
    loadSales();
  };

  const bulkExport = () => {
    const rows = sales.filter((s) => sel.has(s.id));
    if (rows.length === 0) return toast.error(t("bulk.nothingExported"));
    downloadCsv(`sales-${new Date().toISOString().slice(0, 10)}`, rows, [
      { header: "Receipt", value: (r) => r.receipt_number ?? "" },
      { header: "Date", value: (r) => format(new Date(r.created_at), "yyyy-MM-dd HH:mm") },
      { header: "Items", value: (r) => r.sale_items.length },
      { header: "Payment", value: (r) => r.payment_method },
      { header: "Total", value: (r) => r.total },
      { header: "Status", value: (r) => r.returnStatus },
    ]);
    toast.success(t("bulk.exported", { count: rows.length }));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold">{t("sales.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("sales.subtitle")}</p>
      </header>

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
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(s.created_at), "PPp")} · {t("sales.itemsCount", { count: s.sale_items.length })} · {s.payment_method}
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
