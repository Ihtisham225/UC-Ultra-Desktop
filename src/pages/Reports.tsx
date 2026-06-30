// Detailed reports hub: Sales / Purchases / Inventory / P&L / Expenses / Customers & Debts / Tax.
// Each report has a date range, KPI cards, a sortable table, CSV export, and print-to-PDF.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/contexts/ShopContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Printer, FileBarChart, ShoppingCart, PackageOpen, Boxes, TrendingUp, Wallet, Users, Percent } from "lucide-react";
import { downloadCsv, CsvColumn } from "@/lib/csv";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

type Rng = { from: string; to: string };

const todayISO = () => format(new Date(), "yyyy-MM-dd");
const daysAgoISO = (n: number) => format(subDays(new Date(), n), "yyyy-MM-dd");

export default function Reports() {
  usePageMeta({ title: "Reports — UCU", description: "Detailed sales, purchases, inventory, profit & loss, expenses, customers and tax reports with CSV and PDF export.", path: "/reports" });
  const { currentShop } = useShop();
  const perms = usePermissions();
  const formatMoney = useFormatMoney();
  const cur = currentShop?.currency ?? "USD";

  const [range, setRange] = useState<Rng>({ from: daysAgoISO(29), to: todayISO() });
  const [tab, setTab] = useState("sales");

  const setQuick = (days: number) => setRange({ from: daysAgoISO(days - 1), to: todayISO() });

  if (!perms.canManageExpenses) {
    return <div className="p-12 text-center text-muted-foreground">You don't have access to Reports.</div>;
  }
  if (!currentShop) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><FileBarChart className="size-7 text-primary" />Reports</h1>
          <p className="text-muted-foreground mt-1">Detailed business reports with CSV & PDF export.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex items-end gap-2">
            <label className="text-xs text-muted-foreground flex flex-col gap-1">From<Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="h-9 w-[140px]" /></label>
            <label className="text-xs text-muted-foreground flex flex-col gap-1">To<Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="h-9 w-[140px]" /></label>
          </div>
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {[7, 30, 90, 365].map((d) => (
              <Button key={d} size="sm" variant="ghost" onClick={() => setQuick(d)} className="h-7 px-2 text-xs">{d}d</Button>
            ))}
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto print:hidden">
          <TabsTrigger value="sales"><ShoppingCart className="size-3.5 mr-1.5" />Sales</TabsTrigger>
          <TabsTrigger value="purchases"><PackageOpen className="size-3.5 mr-1.5" />Purchases</TabsTrigger>
          <TabsTrigger value="inventory"><Boxes className="size-3.5 mr-1.5" />Inventory</TabsTrigger>
          <TabsTrigger value="pnl"><TrendingUp className="size-3.5 mr-1.5" />Profit & Loss</TabsTrigger>
          <TabsTrigger value="expenses"><Wallet className="size-3.5 mr-1.5" />Expenses</TabsTrigger>
          <TabsTrigger value="customers"><Users className="size-3.5 mr-1.5" />Customers & Debts</TabsTrigger>
          <TabsTrigger value="tax"><Percent className="size-3.5 mr-1.5" />Tax</TabsTrigger>
        </TabsList>

        <div id="report-print-area" className="space-y-4">
          <div className="hidden print:block mb-4">
            <h2 className="text-2xl font-bold">{currentShop.name} — Report</h2>
            <p className="text-sm text-muted-foreground">{range.from} → {range.to} · Generated {format(new Date(), "PPpp")}</p>
          </div>

          <TabsContent value="sales"><SalesReport shopId={currentShop.id} range={range} formatMoney={formatMoney} cur={cur} /></TabsContent>
          <TabsContent value="purchases"><PurchasesReport shopId={currentShop.id} range={range} formatMoney={formatMoney} cur={cur} /></TabsContent>
          <TabsContent value="inventory"><InventoryReport shopId={currentShop.id} formatMoney={formatMoney} cur={cur} /></TabsContent>
          <TabsContent value="pnl"><PnlReport shopId={currentShop.id} range={range} formatMoney={formatMoney} cur={cur} /></TabsContent>
          <TabsContent value="expenses"><ExpensesReport shopId={currentShop.id} range={range} formatMoney={formatMoney} cur={cur} /></TabsContent>
          <TabsContent value="customers"><CustomersReport shopId={currentShop.id} range={range} formatMoney={formatMoney} cur={cur} /></TabsContent>
          <TabsContent value="tax"><TaxReport shopId={currentShop.id} range={range} formatMoney={formatMoney} cur={cur} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

/* ---------- Shared bits ---------- */

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4 shadow-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-0.5 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

function ReportToolbar<T>({ title, rows, columns, filename }: { title: string; rows: T[]; columns: CsvColumn<T>[]; filename: string }) {
  return (
    <div className="flex items-center justify-between gap-2 print:hidden">
      <h3 className="font-semibold">{title}</h3>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => downloadCsv(filename, rows, columns)} disabled={rows.length === 0}><Download className="size-3.5 mr-1.5" />CSV</Button>
        <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="size-3.5 mr-1.5" />PDF / Print</Button>
      </div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-sm text-muted-foreground py-8 text-center">{msg}</div>;
}

function useRange(range: Rng) {
  return useMemo(() => ({
    fromISO: startOfDay(new Date(range.from)).toISOString(),
    toISO: endOfDay(new Date(range.to)).toISOString(),
    fromDate: range.from,
    toDate: range.to,
  }), [range]);
}

type ReportProps = { shopId: string; range: Rng; formatMoney: (n: number | string, c?: string) => string; cur: string };

/* ---------- Sales ---------- */

function SalesReport({ shopId, range, formatMoney, cur }: ReportProps) {
  const { fromISO, toISO } = useRange(range);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales")
        .select("id, receipt_number, total, subtotal, tax, discount, payment_method, created_at, customer_id, cashier_id, customers(name), sale_items(quantity)")
        .eq("shop_id", shopId).gte("created_at", fromISO).lte("created_at", toISO)
        .order("created_at", { ascending: false });
      setRows((data ?? []) as any[]);
      setLoading(false);
    })();
  }, [shopId, fromISO, toISO]);

  const stats = useMemo(() => {
    const revenue = rows.reduce((a, r) => a + Number(r.total), 0);
    const subtotal = rows.reduce((a, r) => a + Number(r.subtotal), 0);
    const tax = rows.reduce((a, r) => a + Number(r.tax), 0);
    const discount = rows.reduce((a, r) => a + Number(r.discount), 0);
    const items = rows.reduce((a, r) => a + (r.sale_items?.reduce((x: number, i: any) => x + Number(i.quantity), 0) ?? 0), 0);
    return { revenue, subtotal, tax, discount, items, count: rows.length, avg: rows.length ? revenue / rows.length : 0 };
  }, [rows]);

  const columns: CsvColumn<any>[] = [
    { header: "Date", value: (r) => format(new Date(r.created_at), "yyyy-MM-dd HH:mm") },
    { header: "Receipt", value: (r) => r.receipt_number ?? r.id.slice(0, 8) },
    { header: "Customer", value: (r) => r.customers?.name ?? "Walk-in" },
    { header: "Payment", value: (r) => r.payment_method },
    { header: "Subtotal", value: (r) => Number(r.subtotal).toFixed(2) },
    { header: "Discount", value: (r) => Number(r.discount).toFixed(2) },
    { header: "Tax", value: (r) => Number(r.tax).toFixed(2) },
    { header: "Total", value: (r) => Number(r.total).toFixed(2) },
  ];

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Revenue" value={formatMoney(stats.revenue, cur)} sub={`${stats.count} transactions`} />
        <KPI label="Average ticket" value={formatMoney(stats.avg, cur)} />
        <KPI label="Items sold" value={String(stats.items)} />
        <KPI label="Tax collected" value={formatMoney(stats.tax, cur)} sub={`Discounts ${formatMoney(stats.discount, cur)}`} />
      </div>
      <Card className="shadow-card p-4">
        <ReportToolbar title="Sales detail" rows={rows} columns={columns} filename={`sales_${range.from}_${range.to}`} />
        {rows.length === 0 ? <Empty msg="No sales in this range." /> : (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Receipt</TableHead><TableHead>Customer</TableHead><TableHead>Payment</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead><TableHead className="text-right">Tax</TableHead><TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{format(new Date(r.created_at), "MMM d, HH:mm")}</TableCell>
                    <TableCell className="font-mono text-xs">{r.receipt_number ?? r.id.slice(0, 8)}</TableCell>
                    <TableCell>{r.customers?.name ?? "Walk-in"}</TableCell>
                    <TableCell className="capitalize">{r.payment_method}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.subtotal, cur)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.tax, cur)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatMoney(r.total, cur)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- Purchases ---------- */

function PurchasesReport({ shopId, range, formatMoney, cur }: ReportProps) {
  const { fromISO, toISO } = useRange(range);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("purchases")
        .select("id, reference_number, total, paid_amount, payment_method, created_at, suppliers(name), purchase_items(quantity)")
        .eq("shop_id", shopId).gte("created_at", fromISO).lte("created_at", toISO)
        .order("created_at", { ascending: false });
      setRows((data ?? []) as any[]);
      setLoading(false);
    })();
  }, [shopId, fromISO, toISO]);

  const stats = useMemo(() => {
    const total = rows.reduce((a, r) => a + Number(r.total), 0);
    const paid = rows.reduce((a, r) => a + Number(r.paid_amount), 0);
    const items = rows.reduce((a, r) => a + (r.purchase_items?.reduce((x: number, i: any) => x + Number(i.quantity), 0) ?? 0), 0);
    return { total, paid, due: total - paid, items, count: rows.length };
  }, [rows]);

  const columns: CsvColumn<any>[] = [
    { header: "Date", value: (r) => format(new Date(r.created_at), "yyyy-MM-dd HH:mm") },
    { header: "Reference", value: (r) => r.reference_number ?? r.id.slice(0, 8) },
    { header: "Supplier", value: (r) => r.suppliers?.name ?? "—" },
    { header: "Payment", value: (r) => r.payment_method },
    { header: "Total", value: (r) => Number(r.total).toFixed(2) },
    { header: "Paid", value: (r) => Number(r.paid_amount).toFixed(2) },
  ];

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Purchases total" value={formatMoney(stats.total, cur)} sub={`${stats.count} purchases`} />
        <KPI label="Amount paid" value={formatMoney(stats.paid, cur)} />
        <KPI label="Outstanding" value={formatMoney(stats.due, cur)} />
        <KPI label="Items received" value={String(stats.items)} />
      </div>
      <Card className="shadow-card p-4">
        <ReportToolbar title="Purchase detail" rows={rows} columns={columns} filename={`purchases_${range.from}_${range.to}`} />
        {rows.length === 0 ? <Empty msg="No purchases in this range." /> : (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Reference</TableHead><TableHead>Supplier</TableHead><TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{format(new Date(r.created_at), "MMM d, HH:mm")}</TableCell>
                    <TableCell className="font-mono text-xs">{r.reference_number ?? r.id.slice(0, 8)}</TableCell>
                    <TableCell>{r.suppliers?.name ?? "—"}</TableCell>
                    <TableCell className="capitalize">{r.payment_method}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.total, cur)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.paid_amount, cur)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- Inventory ---------- */

function InventoryReport({ shopId, formatMoney, cur }: Omit<ReportProps, "range">) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: products }, { data: pi }] = await Promise.all([
        supabase.from("products").select("id, name, sku, category, stock, price, low_stock_threshold, is_active").eq("shop_id", shopId).eq("is_active", true),
        supabase.from("purchase_items").select("product_id, quantity, unit_cost, purchases!inner(shop_id)").eq("purchases.shop_id", shopId),
      ]);
      const totals = new Map<string, { qty: number; cost: number }>();
      ((pi ?? []) as any[]).forEach((r) => {
        if (!r.product_id) return;
        const cur = totals.get(r.product_id) ?? { qty: 0, cost: 0 };
        cur.qty += Number(r.quantity); cur.cost += Number(r.quantity) * Number(r.unit_cost);
        totals.set(r.product_id, cur);
      });
      const enriched = ((products ?? []) as any[]).map((p) => {
        const t = totals.get(p.id);
        const avgCost = t && t.qty > 0 ? t.cost / t.qty : 0;
        return { ...p, avgCost, stockValue: avgCost * Number(p.stock), retailValue: Number(p.price) * Number(p.stock) };
      }).sort((a, b) => b.stockValue - a.stockValue);
      setRows(enriched);
      setLoading(false);
    })();
  }, [shopId]);

  const stats = useMemo(() => {
    const sku = rows.length;
    const units = rows.reduce((a, r) => a + Number(r.stock), 0);
    const stockValue = rows.reduce((a, r) => a + r.stockValue, 0);
    const retailValue = rows.reduce((a, r) => a + r.retailValue, 0);
    const low = rows.filter((r) => Number(r.stock) > 0 && Number(r.stock) <= Number(r.low_stock_threshold)).length;
    const out = rows.filter((r) => Number(r.stock) <= 0).length;
    return { sku, units, stockValue, retailValue, low, out };
  }, [rows]);

  const columns: CsvColumn<any>[] = [
    { header: "Product", value: (r) => r.name },
    { header: "SKU", value: (r) => r.sku ?? "" },
    { header: "Category", value: (r) => r.category ?? "" },
    { header: "Stock", value: (r) => Number(r.stock) },
    { header: "Low threshold", value: (r) => Number(r.low_stock_threshold) },
    { header: "Avg cost", value: (r) => r.avgCost.toFixed(2) },
    { header: "Price", value: (r) => Number(r.price).toFixed(2) },
    { header: "Stock value (cost)", value: (r) => r.stockValue.toFixed(2) },
    { header: "Retail value", value: (r) => r.retailValue.toFixed(2) },
  ];

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="SKUs" value={String(stats.sku)} sub={`${stats.units} units`} />
        <KPI label="Stock value (cost)" value={formatMoney(stats.stockValue, cur)} />
        <KPI label="Retail value" value={formatMoney(stats.retailValue, cur)} />
        <KPI label="Stock alerts" value={`${stats.low + stats.out}`} sub={`${stats.out} out · ${stats.low} low`} />
      </div>
      <Card className="shadow-card p-4">
        <ReportToolbar title="Stock detail" rows={rows} columns={columns} filename="inventory" />
        {rows.length === 0 ? <Empty msg="No products." /> : (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Avg cost</TableHead><TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Stock value</TableHead><TableHead className="text-right">Retail value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const out = Number(r.stock) <= 0;
                  const low = !out && Number(r.stock) <= Number(r.low_stock_threshold);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="font-mono text-xs">{r.sku ?? "—"}</TableCell>
                      <TableCell className={`text-right tabular-nums ${out ? "text-destructive font-semibold" : low ? "text-warning font-semibold" : ""}`}>{r.stock}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(r.avgCost, cur)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(r.price, cur)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(r.stockValue, cur)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(r.retailValue, cur)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- P&L ---------- */

function PnlReport({ shopId, range, formatMoney, cur }: ReportProps) {
  const { fromISO, toISO, fromDate, toDate } = useRange(range);
  const [data, setData] = useState<{ revenue: number; subtotal: number; tax: number; cogs: number; expenses: number; expByCat: { name: string; total: number }[] } | null>(null);

  useEffect(() => {
    (async () => {
      const [s, e, pi, cats] = await Promise.all([
        supabase.from("sales").select("total, subtotal, tax, sale_items(product_id, variant_id, quantity)").eq("shop_id", shopId).gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("expenses").select("amount, category_id").eq("shop_id", shopId).gte("expense_date", fromDate).lte("expense_date", toDate),
        supabase.from("purchase_items").select("product_id, variant_id, quantity, unit_cost, purchases!inner(shop_id)").eq("purchases.shop_id", shopId),
        supabase.from("expense_categories").select("id, name").eq("shop_id", shopId),
      ]);
      const sales = (s.data ?? []) as any[];
      const exps = (e.data ?? []) as any[];
      const items = sales.flatMap((sl) => sl.sale_items ?? []);
      const avg = new Map<string, number>();
      const totals = new Map<string, { qty: number; cost: number }>();
      ((pi.data ?? []) as any[]).forEach((r) => {
        const k = r.variant_id ?? r.product_id; if (!k) return;
        const cur = totals.get(k) ?? { qty: 0, cost: 0 };
        cur.qty += Number(r.quantity); cur.cost += Number(r.quantity) * Number(r.unit_cost);
        totals.set(k, cur);
      });
      totals.forEach((v, k) => avg.set(k, v.qty > 0 ? v.cost / v.qty : 0));
      const cogs = items.reduce((a, it) => {
        const k = it.variant_id ?? it.product_id;
        return a + Number(it.quantity) * (k ? avg.get(k) ?? 0 : 0);
      }, 0);
      const catMap = new Map<string, string>(((cats.data ?? []) as any[]).map((c) => [c.id, c.name]));
      const byCat = new Map<string, number>();
      exps.forEach((ex) => {
        const name = ex.category_id ? catMap.get(ex.category_id) ?? "Other" : "Uncategorized";
        byCat.set(name, (byCat.get(name) ?? 0) + Number(ex.amount));
      });
      setData({
        revenue: sales.reduce((a, x) => a + Number(x.total), 0),
        subtotal: sales.reduce((a, x) => a + Number(x.subtotal), 0),
        tax: sales.reduce((a, x) => a + Number(x.tax), 0),
        cogs,
        expenses: exps.reduce((a, x) => a + Number(x.amount), 0),
        expByCat: Array.from(byCat.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
      });
    })();
  }, [shopId, fromISO, toISO, fromDate, toDate]);

  if (!data) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  const grossProfit = data.subtotal - data.cogs;
  const margin = data.subtotal > 0 ? (grossProfit / data.subtotal) * 100 : 0;
  const netProfit = grossProfit - data.expenses;

  const rows = [
    { label: "Revenue (incl. tax)", value: data.revenue },
    { label: "Tax collected", value: data.tax },
    { label: "Net sales (subtotal)", value: data.subtotal },
    { label: "Cost of goods sold (COGS)", value: -data.cogs },
    { label: "Gross profit", value: grossProfit, strong: true },
    ...data.expByCat.map((c) => ({ label: `Expense — ${c.name}`, value: -c.total })),
    { label: "Total expenses", value: -data.expenses },
    { label: "Net profit", value: netProfit, strong: true },
  ];

  const columns: CsvColumn<any>[] = [
    { header: "Line", value: (r) => r.label },
    { header: "Amount", value: (r) => Number(r.value).toFixed(2) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Revenue" value={formatMoney(data.revenue, cur)} />
        <KPI label="Gross profit" value={formatMoney(grossProfit, cur)} sub={`${margin.toFixed(1)}% margin`} />
        <KPI label="Expenses" value={formatMoney(data.expenses, cur)} />
        <KPI label="Net profit" value={formatMoney(netProfit, cur)} sub={netProfit >= 0 ? "Profitable" : "Loss"} />
      </div>
      <Card className="shadow-card p-4">
        <ReportToolbar title="Profit & Loss statement" rows={rows} columns={columns} filename={`pnl_${range.from}_${range.to}`} />
        <div className="mt-3 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Line</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i} className={r.strong ? "bg-muted/40 font-semibold" : ""}>
                  <TableCell>{r.label}</TableCell>
                  <TableCell className={`text-right tabular-nums ${r.value < 0 ? "text-destructive" : ""}`}>{formatMoney(r.value, cur)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Expenses ---------- */

function ExpensesReport({ shopId, range, formatMoney, cur }: ReportProps) {
  const { fromDate, toDate } = useRange(range);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("expenses")
        .select("id, amount, description, expense_date, payment_method, paid_to, expense_categories(name, color)")
        .eq("shop_id", shopId).gte("expense_date", fromDate).lte("expense_date", toDate)
        .order("expense_date", { ascending: false });
      setRows((data ?? []) as any[]);
      setLoading(false);
    })();
  }, [shopId, fromDate, toDate]);

  const stats = useMemo(() => {
    const total = rows.reduce((a, r) => a + Number(r.amount), 0);
    const byCat = new Map<string, number>();
    rows.forEach((r) => {
      const n = r.expense_categories?.name ?? "Uncategorized";
      byCat.set(n, (byCat.get(n) ?? 0) + Number(r.amount));
    });
    return { total, byCat: Array.from(byCat.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total) };
  }, [rows]);

  const columns: CsvColumn<any>[] = [
    { header: "Date", value: (r) => r.expense_date },
    { header: "Category", value: (r) => r.expense_categories?.name ?? "Uncategorized" },
    { header: "Paid to", value: (r) => r.paid_to ?? "" },
    { header: "Description", value: (r) => r.description ?? "" },
    { header: "Payment", value: (r) => r.payment_method },
    { header: "Amount", value: (r) => Number(r.amount).toFixed(2) },
  ];

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total expenses" value={formatMoney(stats.total, cur)} sub={`${rows.length} entries`} />
        {stats.byCat.slice(0, 3).map((c) => <KPI key={c.name} label={c.name} value={formatMoney(c.total, cur)} sub={`${((c.total / (stats.total || 1)) * 100).toFixed(0)}%`} />)}
      </div>
      <Card className="shadow-card p-4">
        <ReportToolbar title="Expense detail" rows={rows} columns={columns} filename={`expenses_${range.from}_${range.to}`} />
        {rows.length === 0 ? <Empty msg="No expenses in this range." /> : (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Paid to</TableHead>
                <TableHead>Description</TableHead><TableHead>Payment</TableHead><TableHead className="text-right">Amount</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{r.expense_date}</TableCell>
                    <TableCell>{r.expense_categories?.name ?? "Uncategorized"}</TableCell>
                    <TableCell>{r.paid_to ?? "—"}</TableCell>
                    <TableCell className="max-w-[260px] truncate">{r.description ?? "—"}</TableCell>
                    <TableCell className="capitalize">{r.payment_method}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.amount, cur)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- Customers & Debts ---------- */

function CustomersReport({ shopId, range, formatMoney, cur }: ReportProps) {
  const { fromISO, toISO } = useRange(range);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, d] = await Promise.all([
        supabase.from("sales").select("total, customer_id, customers(name, phone)").eq("shop_id", shopId).gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("debts").select("id, person_name, phone, amount, paid_amount, direction, status, due_date").eq("shop_id", shopId).eq("status", "open"),
      ]);
      const map = new Map<string, { name: string; phone: string; spent: number; visits: number }>();
      ((s.data ?? []) as any[]).filter((r) => r.customer_id).forEach((r) => {
        const cur = map.get(r.customer_id) ?? { name: r.customers?.name ?? "—", phone: r.customers?.phone ?? "", spent: 0, visits: 0 };
        cur.spent += Number(r.total); cur.visits += 1;
        map.set(r.customer_id, cur);
      });
      setTopCustomers(Array.from(map.values()).sort((a, b) => b.spent - a.spent).slice(0, 50));
      setDebts((d.data ?? []) as any[]);
      setLoading(false);
    })();
  }, [shopId, fromISO, toISO]);

  const custCols: CsvColumn<any>[] = [
    { header: "Customer", value: (r) => r.name },
    { header: "Phone", value: (r) => r.phone },
    { header: "Visits", value: (r) => r.visits },
    { header: "Total spent", value: (r) => r.spent.toFixed(2) },
  ];
  const debtCols: CsvColumn<any>[] = [
    { header: "Name", value: (r) => r.person_name },
    { header: "Phone", value: (r) => r.phone ?? "" },
    { header: "Direction", value: (r) => r.direction },
    { header: "Amount", value: (r) => Number(r.amount).toFixed(2) },
    { header: "Paid", value: (r) => Number(r.paid_amount).toFixed(2) },
    { header: "Balance", value: (r) => (Number(r.amount) - Number(r.paid_amount)).toFixed(2) },
    { header: "Due", value: (r) => r.due_date ?? "" },
  ];

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  const receivable = debts.filter((d) => d.direction === "receivable").reduce((a, d) => a + (Number(d.amount) - Number(d.paid_amount)), 0);
  const payable = debts.filter((d) => d.direction === "payable").reduce((a, d) => a + (Number(d.amount) - Number(d.paid_amount)), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Active customers" value={String(topCustomers.length)} />
        <KPI label="Customer revenue" value={formatMoney(topCustomers.reduce((a, c) => a + c.spent, 0), cur)} />
        <KPI label="Receivable" value={formatMoney(receivable, cur)} sub="Owed to you" />
        <KPI label="Payable" value={formatMoney(payable, cur)} sub="You owe" />
      </div>
      <Card className="shadow-card p-4">
        <ReportToolbar title="Top customers" rows={topCustomers} columns={custCols} filename={`top_customers_${range.from}_${range.to}`} />
        {topCustomers.length === 0 ? <Empty msg="No customer sales in this range." /> : (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Phone</TableHead><TableHead className="text-right">Visits</TableHead><TableHead className="text-right">Spent</TableHead></TableRow></TableHeader>
              <TableBody>
                {topCustomers.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-xs">{c.phone || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.visits}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatMoney(c.spent, cur)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
      <Card className="shadow-card p-4">
        <ReportToolbar title="Open debts" rows={debts} columns={debtCols} filename="open_debts" />
        {debts.length === 0 ? <Empty msg="No open debts." /> : (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Direction</TableHead><TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Due</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {debts.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.person_name}</TableCell>
                    <TableCell className="capitalize">{d.direction}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(d.amount, cur)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(d.paid_amount, cur)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatMoney(Number(d.amount) - Number(d.paid_amount), cur)}</TableCell>
                    <TableCell className="text-xs">{d.due_date ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- Tax ---------- */

function TaxReport({ shopId, range, formatMoney, cur }: ReportProps) {
  const { fromISO, toISO } = useRange(range);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales")
        .select("created_at, subtotal, tax, total")
        .eq("shop_id", shopId).gte("created_at", fromISO).lte("created_at", toISO);
      setRows((data ?? []) as any[]);
      setLoading(false);
    })();
  }, [shopId, fromISO, toISO]);

  const byMonth = useMemo(() => {
    const map = new Map<string, { period: string; taxable: number; tax: number; gross: number; count: number }>();
    rows.forEach((r) => {
      const key = format(new Date(r.created_at), "yyyy-MM");
      const cur = map.get(key) ?? { period: key, taxable: 0, tax: 0, gross: 0, count: 0 };
      cur.taxable += Number(r.subtotal); cur.tax += Number(r.tax); cur.gross += Number(r.total); cur.count += 1;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));
  }, [rows]);

  const totals = useMemo(() => byMonth.reduce((a, m) => ({ taxable: a.taxable + m.taxable, tax: a.tax + m.tax, gross: a.gross + m.gross, count: a.count + m.count }), { taxable: 0, tax: 0, gross: 0, count: 0 }), [byMonth]);

  const columns: CsvColumn<any>[] = [
    { header: "Period", value: (r) => r.period },
    { header: "Transactions", value: (r) => r.count },
    { header: "Taxable", value: (r) => r.taxable.toFixed(2) },
    { header: "Tax", value: (r) => r.tax.toFixed(2) },
    { header: "Gross", value: (r) => r.gross.toFixed(2) },
  ];

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Transactions" value={String(totals.count)} />
        <KPI label="Taxable revenue" value={formatMoney(totals.taxable, cur)} />
        <KPI label="Tax collected" value={formatMoney(totals.tax, cur)} />
        <KPI label="Gross revenue" value={formatMoney(totals.gross, cur)} />
      </div>
      <Card className="shadow-card p-4">
        <ReportToolbar title="Tax by month" rows={byMonth} columns={columns} filename={`tax_${range.from}_${range.to}`} />
        {byMonth.length === 0 ? <Empty msg="No sales in this range." /> : (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Period</TableHead><TableHead className="text-right">Transactions</TableHead>
                <TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">Tax</TableHead><TableHead className="text-right">Gross</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {byMonth.map((m) => (
                  <TableRow key={m.period}>
                    <TableCell className="font-medium">{m.period}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(m.taxable, cur)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatMoney(m.tax, cur)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(m.gross, cur)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
