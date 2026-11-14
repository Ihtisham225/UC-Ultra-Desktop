import { orderNumberLabel } from "@/lib/format";
import { useEffect, useMemo, useState } from "react";
import { useLandingParams } from "@/hooks/useLandingParams";
import { useTranslation } from "react-i18next";
import { useShop } from "@/contexts/ShopContext";
import { Card } from "@/components/ui/card";
import { RowActions } from "@/components/RowActions";
import { Plus, Receipt as ReceiptIcon, ChevronRight, Eye, Undo2, Trash2, Pencil, Truck, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SaleKindBadges } from "@/components/SaleKindBadges";
import { orderTypeLabel, parseFilter, paymentStatus, PAYMENT_LABELS, saleFilterOptions, saleMatchesFilter } from "@/lib/order-types";
import { Checkbox } from "@/components/ui/checkbox";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { format } from "date-fns";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import { rpc } from "@/lib/apiClient";
import { ReturnDialog } from "@/components/ReturnDialog";
import { useConfirm } from "@/components/ConfirmDialog";
import { Pagination } from "@/components/Pagination";
import { SCROLL_BATCH } from "@/hooks/usePagination";
import { useRowSelection } from "@/hooks/useRowSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { downloadCsv } from "@/lib/csv";
import { toast } from "sonner";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useLocalStore } from "@/hooks/useLocalStore";
import { deleteLocal, notifyChange } from "@/lib/localDb";
import { voidSaleLocally } from "@/lib/voidSaleLocal";
import { syncNow } from "@/lib/syncEngine";
import { DeliveryOrderDialog, type DeliveryOrderInput, type DeliveryOrderRow, type DeliveryOrdersApi } from "@/components/DeliveryOrderDialog";
import type { OrderSlipDto } from "@/lib/order-slip";
import { ManualSaleDialog, type ManualSaleApi } from "@/components/ManualSaleDialog";
import { EditSaleDialog, type EditableSale, type EditableProduct } from "@/components/EditSaleDialog";
import { soldAs, formatSoldQuantity } from "@/lib/sale-units";
import { useAddNew } from "@/hooks/useAddNew";
import { DateInput } from "@/components/DateInput";
import { fmtDateTime } from "@/lib/date-format";

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

/** yyyy-MM-dd for a local day. */
const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayRange = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return { from: isoDay(d), to: isoDay(d) };
};
const lastDays = (n: number) => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (n - 1));
  return { from: isoDay(from), to: isoDay(to) };
};


type ReturnStatus = "none" | "partial" | "full";

interface Sale {
  id: string;
  receipt_number: string | null;
  customer_name?: string | null;
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

/**
 * Delivery orders live on the server and read the bill's lines there. A bill
 * rung up on this till may not have been pushed yet, so creating one syncs
 * first — and needs a connection. ⚠️ rpc() is variadic.
 */
const deliveryApi: DeliveryOrdersApi = {
  list: (saleId: string) => rpc<DeliveryOrderRow[]>("listDeliveryOrdersForSaleAction", saleId),
  create: async (saleId: string, input: DeliveryOrderInput) => {
    if (!navigator.onLine) return { ok: false, error: "Delivery orders need a connection — try again when you're online." };
    await syncNow().catch(() => { /* the server says so if the bill isn't there */ });
    return rpc<{ ok: boolean; error?: string; slip?: OrderSlipDto }>("createDeliveryOrderAction", saleId, input);
  },
  slip: (id: string) => rpc<OrderSlipDto | null>("getDeliveryOrderSlipAction", id),
};

export default function Sales() {
  const [manualOpen, setManualOpen] = useState(false);
  usePageMeta({ title: "Sales History — UCU", description: "Browse past sales, view receipts, filter by date and export to CSV.", path: "/sales" });
  const { t } = useTranslation();
  const { currentShop, role } = useShop();
  const formatMoney = useFormatMoney();
  const canReturn = role === "owner" || role === "manager";
  // Correcting a mistyped bill is a manager's job, same as voiding a purchase.
  const canEdit = role === "owner" || role === "manager";
  const [editSale, setEditSale] = useState<EditableSale | null>(null);
  const [editProducts, setEditProducts] = useState<EditableProduct[]>([]);
  const canDelete = role === "owner";
  const [page, setPage] = useState(1);
  // Infinite scroll: `page` counts the batches of SCROLL_BATCH shown so far.
  const pageSize = SCROLL_BATCH;
  const setPageSize = (_n: number) => { setPage(1); };
  const [openSale, setOpenSale] = useState<any>(null);
  // The bill a delivery order (gate pass for the truck) is being made for.
  const [deliveryFor, setDeliveryFor] = useState<{ id: string; number: string | null } | null>(null);
  const [returnSaleId, setReturnSaleId] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const sel = useRowSelection();

  useEffect(() => { document.title = "UCU"; }, []);

  const { data: allSalesRaw, loading, refresh: loadSales } = useLocalStore<any>("sales", currentShop?.id);
  const { data: allSaleItems, loading: itemsLoading } = useLocalStore<any>("sale_items", currentShop?.id);
  const { data: allOilChanges, loading: oilLoading } = useLocalStore<any>("oil_changes", currentShop?.id);
  const { data: allReturns } = useLocalStore<any>("sale_returns", currentShop?.id);
  // A cached sale row only has the legacy single payment_method, so the tender
  // lines (and the account names) are joined on from their own tables.
  const { data: allPayments } = useLocalStore<any>("sale_payments", currentShop?.id);
  const { data: allAccounts } = useLocalStore<any>("money_accounts", currentShop?.id);
  // Who the bill was for. Parties live in `suppliers` since customers and
  // suppliers became one record, but the legacy `customers` table is still
  // synced for shops that have not been migrated, so both are consulted.
  const { data: allParties } = useLocalStore<any>("suppliers", currentShop?.id);
  const { data: allLegacyCustomers } = useLocalStore<any>("customers", currentShop?.id);

  // Bills that had an oil change recorded with them (lib/order-types filters on it).
  const oilSaleIds = useMemo(
    () => new Set(allOilChanges.map((o: { sale_id?: string | null }) => o.sale_id).filter(Boolean) as string[]),
    [allOilChanges],
  );
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
      const party = s.customer_id
        ? allParties.find((c: any) => c.id === s.customer_id) ??
          allLegacyCustomers.find((c: any) => c.id === s.customer_id)
        : null;
      const customer_name = party?.name ?? null;
      const customer_phone = party?.phone ?? null;
      return {
        ...s, sale_items: items, returnStatus, payments, balance_due, customer_name, customer_phone,
        has_oil_change: oilSaleIds.has(s.id),
      };
    });
  }, [allSalesRaw, allSaleItems, allReturns, allPayments, allAccounts, allParties, allLegacyCustomers, oilSaleIds]);

  // The list opens on today. A shop that has been trading a while has
  // thousands of bills and the counter almost always wants the current day;
  // anything older is one date change away.
  const [range, setRange] = useState(() => dayRange(0));
  /** What's typed in the search box, and the settled value the list filters on. */
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => { setQuery(searchText.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(t);
  }, [searchText]);

  // Order type / oil change / paid-vs-ledger (lib/order-types filterValue).
  const [kind, setKind] = useState("all");

  const inWindow = useMemo(() => {
    // Find a bill — order #, customer or patient name/phone, notes or a product
    // on it. A search looks across EVERY date (same as the web): someone typing
    // a bill number wants that bill, not "nothing today".
    if (query) {
      const q = query.toLowerCase();
      const bill = q.replace(/^#/, "");
      const has = (v: unknown) => typeof v === "string" && v.toLowerCase().includes(q);
      return allSales.filter((s: any) =>
        String(s.receipt_number ?? "").toLowerCase().includes(bill) ||
        has(s.customer_name) || has(s.customer_phone) ||
        has(s.patient_name) || has(s.patient_phone) || has(s.notes) ||
        (s.sale_items ?? []).some((i: any) => has(i.product_name)),
      );
    }
    if (!range.from && !range.to) return allSales;
    return allSales.filter((s: any) => {
      if (!s.created_at) return false;
      const day = isoDay(new Date(s.created_at));
      if (range.from && day < range.from) return false;
      if (range.to && day > range.to) return false;
      return true;
    });
  }, [allSales, range, query]);

  const inRange = useMemo(() => {
    const f = parseFilter(kind);
    return f.kind === "all" ? inWindow : inWindow.filter((s) => saleMatchesFilter(s, f));
  }, [inWindow, kind]);

  const totalCount = inRange.length;
  const grandTotal = inRange.reduce((a: number, s: any) => a + Number(s.total ?? 0), 0);
  // Refunds are counted against the same window, so the two figures on the
  // page always describe the same set of bills.
  const rangeSaleIds = useMemo(() => new Set(inRange.map((s: any) => s.id)), [inRange]);
  const grandRefunded = allReturns
    .filter((r: any) => rangeSaleIds.has(r.sale_id))
    .reduce((a: number, r: any) => a + Number(r.total_refund ?? 0), 0);

  const sales = useMemo(() => {
    // Infinite scroll: every batch shown so far.
    return inRange.slice(0, page * pageSize);
  }, [inRange, page, pageSize]);


  const cur = currentShop?.currency ?? "USD";

  /**
   * Editing corrects stock, investor lots and the customer's balance server
   * side, so it needs a connection — the local row alone can't be trusted to
   * rebuild any of that.
   */
  const openEdit = async (saleId: string) => {
    if (!currentShop) return;
    if (!navigator.onLine) {
      return toast.error("Editing a bill needs a connection — the stock and balance are corrected on the server.");
    }
    const sale = allSales.find((x) => x.id === saleId);
    if (!sale) return;
    if (editProducts.length === 0) {
      try {
        const rows = await rpc<Array<{ id: string; name: string; price: number; unit: string | null; units: { id: string; name: string; factor: number }[]; is_service?: boolean }>>("loadPosProductsAction");
        setEditProducts(rows.map((p) => ({
          id: p.id, name: p.name, price: p.price, unit: p.unit, units: p.units ?? [], is_service: p.is_service,
        })));
      } catch { /* adding lines just won't offer suggestions */ }
    }
    setEditSale({
      id: sale.id,
      receipt_number: sale.receipt_number,
      discount: Number((sale as { discount?: number }).discount ?? 0),
      amount_paid: Number((sale as { amount_paid?: number }).amount_paid ?? 0),
      payment_method: String(sale.payment_method ?? "cash"),
      customer_id: (sale as { customer_id?: string | null }).customer_id ?? null,
      customer_name: sale.customer_name ?? null,
      customer_phone:
        (allParties.find((c: any) => c.id === (sale as any).customer_id)?.phone ??
          allLegacyCustomers.find((c: any) => c.id === (sale as any).customer_id)?.phone) ?? null,
      account_id: (sale as { account_id?: string | null }).account_id ?? null,
      // The tenders as they stand, so a split bill reopens showing its split
      // instead of collapsing onto one account.
      payments: allPayments
        .filter((p: { sale_id?: string }) => p.sale_id === sale.id)
        .map((p: { account_id?: string | null; amount?: number }) => ({
          account_id: p.account_id ?? null,
          amount: Number(p.amount ?? 0),
        })),
      created_at: (sale as { created_at?: string | null }).created_at ?? null,
      order_type: (sale as { order_type?: string | null }).order_type ?? null,
      items: sale.sale_items.map((it) => ({
        product_id: (it as { product_id?: string | null }).product_id ?? null,
        variant_id: (it as { variant_id?: string | null }).variant_id ?? null,
        product_name: it.product_name,
        quantity: Number(it.quantity),
        unit_price: Number((it as { unit_price?: number }).unit_price ?? 0),
        line_total: Number((it as { line_total?: number }).line_total ?? 0),
        unit_label: it.unit_label ?? null,
        unit_factor: it.unit_factor ?? null,
      })),
    });
  };

  // Global search and the vehicle history land here: `?sale=<id>` opens that
  // bill, `?q=` searches every date for it.
  useLandingParams(["sale", "q"] as const, ({ sale, q }) => {
    if (q) { setRange({ from: "", to: "" }); setSearchText(q); }
    if (sale) openReceipt(sale);
  // ⚠️ Wait for the bill LINES and oil changes too, not just the bills. Each
  // table loads from the local store on its own, and opening on the first one
  // printed a receipt with no items at all — every bill opened from the Oil
  // changes / Vehicles history did exactly that (NIAZ OIL, receipt 358).
  }, allSales.length > 0 && !loading && !itemsLoading && !oilLoading);

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
    // The bill's khata row and tenders go with it here and now; the server
    // voids the rest (stock back, cash) when the delete lands — synced at once
    // so the corrected stock comes straight back.
    if (currentShop) await voidSaleLocally(currentShop.id, saleId);
    const saleItems = allSaleItems.filter((i: any) => i.sale_id === saleId);
    for (const item of saleItems) await deleteLocal("sale_items", item.id, true);
    await deleteLocal("sales", saleId, true);
    notifyChange("sales");
    toast.success(t("common.deleted"));
    void syncNow().catch(() => { /* offline: the next sync carries it */ });
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
      if (currentShop) await voidSaleLocally(currentShop.id, id);
      const saleItems = allSaleItems.filter((i: any) => i.sale_id === id);
      for (const item of saleItems) await deleteLocal("sale_items", item.id, true);
      await deleteLocal("sales", id, true);
    }
    notifyChange("sales");
    toast.success(t("bulk.deleted", { count: ids.length }));
    sel.clear();
    void syncNow().catch(() => { /* offline: the next sync carries it */ });
  };

  const bulkExport = () => {
    const rows = sales.filter((s) => sel.has(s.id));
    if (rows.length === 0) return toast.error(t("bulk.nothingExported"));
    downloadCsv(`sales-${new Date().toISOString().slice(0, 10)}`, rows, [
      { header: "Receipt", value: (r) => orderNumberLabel(r.receipt_number) },
      { header: "Customer", value: (r) => r.customer_name ?? "" },
      { header: "Order type", value: (r) => orderTypeLabel(currentShop, r.order_type) },
      { header: "Oil change", value: (r) => (r.has_oil_change ? "Yes" : "") },
      { header: "Paid", value: (r) => PAYMENT_LABELS[paymentStatus(r.total, r.amount_paid ?? 0)] },
      { header: "Date", value: (r) => format(new Date(r.created_at), "yyyy-MM-dd HH:mm") },
      { header: "Items", value: (r) => r.sale_items.length },
      { header: "Payment", value: (r) => (r.payments?.length ? r.payments.map((p) => `${p.account_name} ${p.amount}`).join(" | ") : r.payment_method) },
      { header: "Balance due", value: (r) => ((r.balance_due ?? 0) > 0 ? (r.balance_due ?? 0).toFixed(2) : "") },
      { header: "Total", value: (r) => r.total },
      { header: "Status", value: (r) => r.returnStatus },
    ]);
    toast.success(t("bulk.exported", { count: rows.length }));
  };

  useAddNew({ "manual-sale": () => setManualOpen(true) });

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

      <Card className="p-3 space-y-3">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search a bill — order #, customer, phone or product"
            className="ps-9 pe-9"
          />
          {searchText && (
            <button
              type="button"
              className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchText("")}
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        {query && (
          <p className="text-xs text-muted-foreground">Searching every date for “{query}”. Clear the search to go back to the dates below.</p>
        )}
        <div className={`flex flex-wrap items-end gap-3 ${query ? "opacity-50" : ""}`}>
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <DateInput
              className="h-9 w-40"
              value={range.from}
              onChange={(e) => { setPage(1); setRange((r) => ({ ...r, from: e.target.value })); }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <DateInput
              className="h-9 w-40"
              value={range.to}
              onChange={(e) => { setPage(1); setRange((r) => ({ ...r, to: e.target.value })); }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Show</Label>
            <Select value={kind} onValueChange={(v) => { setPage(1); setKind(v); }}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {saleFilterOptions(currentShop).map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => { setPage(1); setRange(dayRange(0)); }}>Today</Button>
            <Button variant="outline" size="sm" onClick={() => { setPage(1); setRange(dayRange(1)); }}>Yesterday</Button>
            <Button variant="outline" size="sm" onClick={() => { setPage(1); setRange(lastDays(7)); }}>Last 7 days</Button>
            <Button variant="outline" size="sm" onClick={() => { setPage(1); setRange(lastDays(30)); }}>Last 30 days</Button>
            <Button variant="ghost" size="sm" onClick={() => { setPage(1); setRange({ from: "", to: "" }); }}>All time</Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {query || kind !== "all" ? "Matching sales" : range.from || range.to ? "Sales in range" : "Total sales"}
          </div>
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
                <li key={s.id} className="even:bg-muted/25">
                  <div className={`w-full px-4 py-2.5 hover:bg-muted/50 flex items-center justify-between gap-3 text-start transition-colors ${sel.has(s.id) ? "bg-primary/5" : ""}`}>
                    <Checkbox
                      checked={sel.has(s.id)}
                      onCheckedChange={(v) => sel.toggle(s.id, !!v)}
                      aria-label={`select ${s.receipt_number}`}
                    />
                    <button onClick={() => openReceipt(s.id)} className="min-w-0 flex-1 text-start">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold font-mono text-sm">{orderNumberLabel(s.receipt_number)}</span>
                        <SaleKindBadges sale={s} shop={currentShop} formatMoney={(n) => formatMoney(n, cur)} />
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
                        {/* Who the bill was for — the shop looks a sale up by
                            the person as often as by the receipt number. */}
                        {s.customer_name && (
                          <span className="text-foreground/80 font-medium">{s.customer_name} · </span>
                        )}
                        {fmtDateTime(s.created_at)} · {t("sales.itemsCount", { count: s.sale_items.length })} ·{" "}
                        {s.payments?.length
                          ? s.payments.map((p) => `${p.account_name} ${formatMoney(p.amount, cur)}`).join(" · ")
                          : s.payment_method}
                        {(s.balance_due ?? 0) > 0 && (
                          <span className="text-warning font-medium"> · {formatMoney(s.balance_due ?? 0, cur)} on ledger</span>
                        )}
                      </div>
                    </button>
                    <div className={`text-lg font-bold tabular-nums ${s.returnStatus === "full" ? "line-through text-muted-foreground" : ""}`}>
                      {formatMoney(s.total, cur)}
                    </div>
                    <RowActions
                      actions={[
                        { label: t("sales.viewReceipt"), icon: Eye, onClick: () => openReceipt(s.id) },
                        // A returned bill can't be edited — the refund was recorded against these exact lines.
                        { label: "Edit bill", icon: Pencil, onClick: () => openEdit(s.id), hidden: !(canEdit && s.returnStatus === "none") },
                        { label: t("sales.processReturn"), icon: Undo2, onClick: () => setReturnSaleId(s.id), hidden: !(canReturn && s.returnStatus !== "full") },
                        { label: "Delivery order (truck pass)", icon: Truck, onClick: () => setDeliveryFor({ id: s.id, number: s.receipt_number ?? null }) },
                        { label: t("sales.deleteSale"), icon: Trash2, onClick: () => deleteSale(s.id), destructive: true, hidden: !canDelete },
                      ]}
                    />
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
      {currentShop && (
        <DeliveryOrderDialog
          saleId={deliveryFor?.id ?? null}
          billNumber={deliveryFor?.number}
          api={deliveryApi}
          shop={{
            name: currentShop.name,
            address: currentShop.address ?? null,
            phone: currentShop.phone ?? null,
            currency: currentShop.currency ?? "PKR",
            receipt_header: currentShop.receipt_header ?? null,
            receipt_footer: currentShop.receipt_footer ?? null,
          }}
          onClose={() => setDeliveryFor(null)}
        />
      )}
      <ReturnDialog
        open={!!returnSaleId}
        onClose={() => setReturnSaleId(null)}
        saleId={returnSaleId}
        onDone={() => loadSales()}
      />
      <EditSaleDialog
        sale={editSale}
        products={editProducts}
        onClose={() => setEditSale(null)}
        // The server rewrote the bill, its stock and the customer's balance —
        // pull the corrected rows back down so this terminal agrees.
        onSaved={() => { syncNow().catch(() => {}); }}
        submit={(id, input) => rpc<{ ok: boolean; error?: string }>("updateSaleAction", id, input)}
      />

      {confirmDialog}
    </div>
  );
}
