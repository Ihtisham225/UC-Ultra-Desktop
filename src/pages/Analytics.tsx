import { writeOffTotals } from "@/lib/write-offs";
import { untrackedMaterialsCost } from "@/lib/raw-materials";
import { productionCostLinesOf, typedCostLinesOf } from "@/lib/production";
import { bookFromRows, type RecipeBook } from "@/lib/recipe";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAll } from "@/lib/localDb";
import { rpc } from "@/lib/apiClient";
import { useShop } from "@/contexts/ShopContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TrendingUp, DollarSign, ShoppingCart, Users, Lightbulb, BookOpen, AlertTriangle, Award, Target, Sparkles } from "lucide-react";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { format, eachDayOfInterval } from "date-fns";
import { DateInput } from "@/components/DateInput";
import { fmtDate } from "@/lib/date-format";
import { ANALYTICS_PRESETS, analyticsWindow, daysIn, localDay, matchingPreset, parseDay, presetRange } from "@/lib/analytics-window";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { usePageMeta } from "@/hooks/usePageMeta";
import { averageCostsWithRecipes, computePnl } from "@/lib/pnl";
import { ProfitExplainer } from "@/components/ProfitExplainer";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))"];

export default function Analytics() {
  usePageMeta({ title: "Analytics — UCU", description: "Visual reports on revenue, profit, top products and best customers.", path: "/analytics" });
  const { t } = useTranslation();
  const { currentShop } = useShop();
  const formatMoney = useFormatMoney();
  const perms = usePermissions();
  // Local days (lib/analytics-window): Today / 7 / 30 / 90 days / this month, or any From–To.
  const [range, setRange] = useState<{ from: string; to: string }>(() => presetRange("30d"));
  const [loading, setLoading] = useState(true);
  /** Set once the first load lands; later range changes keep the page up. */
  const [loaded, setLoaded] = useState(false);
  const { from, to } = range;
  const days = daysIn(from, to);
  const singleDay = from === to;
  const [sales, setSales] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [assetEffects, setAssetEffects] = useState({ depreciation: 0, disposal_gain: 0 });
  /** Weighted average cost per product_id or variant_id, derived from all purchase_items. */
  const [avgCost, setAvgCost] = useState<Map<string, number>>(new Map());
  const [customerCount, setCustomerCount] = useState(0);
  const [pnlExtra, setPnlExtra] = useState<{ returns: any[]; purchaseItems: any[]; serviceIds: Set<string>; recipes?: RecipeBook; writeOffs?: { shopUse: number; wastage: number }; rawMaterials?: number }>({
    returns: [], purchaseItems: [], serviceIds: new Set(),
  });

  useEffect(() => { document.title = "UCU"; }, []);

  useEffect(() => {
    if (!currentShop || !DAY.test(from) || !DAY.test(to)) return;
    let stale = false;
    (async () => {
      setLoading(true);
      // The window's local days and the instants they begin and end at.
      const win = analyticsWindow(from, to);
      const since = win.fromIso;
      const until = win.toIso;
      const inWindow = (iso: string) => iso >= since && iso < until;
      const dayIn = (day: unknown) => { const d = String(day).slice(0, 10); return d >= win.from && d <= win.to; };
      const shopId = currentShop.id;
      // Read from the local sync store — offline-capable, all these tables sync.
      const [allSales, allSaleItems, allProducts, allExpenses, allCustomers, allPurchaseItems, allReturns, allReturnItems, runs, recipeLines, writeOffRows, allPurchases] = await Promise.all([
        getAll<any>("sales", shopId),
        getAll<any>("sale_items", shopId),
        getAll<any>("products", shopId),
        perms.canManageExpenses ? getAll<any>("expenses", shopId) : Promise.resolve([] as any[]),
        getAll<any>("customers", shopId),
        getAll<any>("purchase_items", shopId),
        getAll<any>("sale_returns", shopId),
        getAll<any>("sale_return_items", shopId),
        // Cafe: batches are cost lines, recipes cost made-to-order items (lib/pnl).
        getAll<any>("production_runs", shopId),
        getAll<any>("product_recipe_lines", shopId),
        // Used in the shop / wasted — their own P&L lines.
        getAll<any>("stock_write_offs", shopId),
        // Untracked raw materials count as used when bought (lib/raw-materials).
        getAll<any>("purchases", shopId),
      ]);
      // Returns in the range take their refund off sales and their goods' cost
      // off COGS (lib/pnl).
      const itemsByReturn = new Map<string, any[]>();
      for (const it of allReturnItems) {
        const arr = itemsByReturn.get(it.return_id) ?? [];
        arr.push(it);
        itemsByReturn.set(it.return_id, arr);
      }
      setPnlExtra({
        returns: allReturns
          .filter((r) => inWindow(new Date(r.created_at).toISOString()))
          .map((r) => ({ total_refund: r.total_refund, items: itemsByReturn.get(r.id) ?? [] })),
        purchaseItems: [...allPurchaseItems, ...productionCostLinesOf(runs), ...typedCostLinesOf(allProducts)],
        serviceIds: new Set(allProducts.filter((p) => p.is_service).map((p) => p.id)),
        recipes: bookFromRows(allProducts, recipeLines),
        // write-offs carry a plain day, so compare with the window's LOCAL first day —
        // `since` is an instant, and its UTC date is the day before east of Greenwich.
        // Write-offs carry a plain day, so they're compared with the window's local days.
        writeOffs: writeOffTotals(writeOffRows.filter((w) => dayIn(w.date))),
        rawMaterials: untrackedMaterialsCost(allProducts, allPurchases, allPurchaseItems, since, new Date(until)),
      });
      const itemsBySale = new Map<string, any[]>();
      for (const it of allSaleItems) {
        const arr = itemsBySale.get(it.sale_id) ?? [];
        arr.push(it);
        itemsBySale.set(it.sale_id, arr);
      }
      const salesData = allSales
        .filter((sl) => inWindow(new Date(sl.created_at).toISOString()))
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
        .map((sl) => ({ ...sl, sale_items: itemsBySale.get(sl.id) ?? [] }));
      setSales(salesData);
      setItems(salesData.flatMap((sl: any) => (sl.sale_items ?? []).map((it: any) => ({ ...it, created_at: sl.created_at }))));
      setProducts(allProducts.filter((p) => p.is_active !== false));
      setExpenses(allExpenses.filter((e) => dayIn(e.expense_date)));
      setCustomerCount(allCustomers.length);

      // Payroll isn't synced locally — fetch it online (0 when offline).
      if (perms.canManageExpenses && navigator.onLine) {
        // The action counts days back from today, so ask from the window's
        // first day and trim anything after its last.
        try {
          const back = daysIn(win.from, localDay(new Date()));
          const rows = await rpc<any[]>("listPayrollForAnalyticsAction", back);
          if (!stale) setPayroll(rows.filter((p) => dayIn(p.date)));
        }
        catch { setPayroll([]); }
        // Fixed-asset depreciation, likewise server-only.
        try {
          setAssetEffects(await rpc<{ depreciation: number; disposal_gain: number }>(
            "assetEffectsAction", win.from, win.to,
          ));
        } catch { setAssetEffects({ depreciation: 0, disposal_gain: 0 }); }
      } else {
        setPayroll([]);
        setAssetEffects({ depreciation: 0, disposal_gain: 0 });
      }

      // Weighted average landed cost, key = variant_id || product_id — the
      // P&L's own basis (lib/pnl), so batch-made and made-to-order items are
      // costed too.
      setAvgCost(averageCostsWithRecipes(
        [...allPurchaseItems, ...productionCostLinesOf(runs), ...typedCostLinesOf(allProducts)],
        bookFromRows(allProducts, recipeLines),
      ));

      if (stale) return;
      setLoading(false);
      setLoaded(true);
    })();
    return () => { stale = true; };
  }, [currentShop, from, to, perms.canManageExpenses]);

  const cur = currentShop?.currency ?? "USD";

  // lib/pnl is the one calculation — the Profit & Loss report and the
  // dashboard tile use it too, and so does the web. (This page used to take
  // expenses straight off revenue, forgetting what the goods cost.)
  const pnl = useMemo(() => computePnl({
    sales: sales.map((s) => ({ subtotal: s.subtotal, tax: s.tax, total: s.total, items: s.sale_items ?? [] })),
    returns: pnlExtra.returns,
    purchaseItems: pnlExtra.purchaseItems,
    expenses: expenses.reduce((a, e) => a + Number(e.amount), 0),
    payroll: payroll.reduce((a, p) => a + Number(p.amount), 0),
    depreciation: assetEffects.depreciation,
    assetGain: assetEffects.disposal_gain,
    serviceIds: pnlExtra.serviceIds,
    recipes: pnlExtra.recipes,
    shopUse: pnlExtra.writeOffs?.shopUse ?? 0,
    wastage: pnlExtra.writeOffs?.wastage ?? 0,
    rawMaterials: pnlExtra.rawMaterials ?? 0,
  }), [sales, expenses, payroll, assetEffects, pnlExtra]);

  const stats = useMemo(() => {
    const txnCount = sales.length;
    return {
      revenue: pnl.netSales,
      profit: pnl.grossProfit,
      margin: pnl.margin,
      txnCount,
      avgTicket: txnCount > 0 ? pnl.billed / txnCount : 0,
      netProfit: pnl.netProfit,
      overheads: pnl.overheads,
    };
  }, [sales, pnl]);

  const dailySeries = useMemo(() => {
    if (!DAY.test(from) || !DAY.test(to)) return [];
    // One day: by the hour, or the chart is a single dot.
    if (singleDay) {
      const byHour = new Array(24).fill(0);
      for (const s of sales) byHour[new Date(s.created_at).getHours()] += Number(s.total);
      const dayExpense =
        expenses.reduce((a, e) => a + Number(e.amount), 0) + payroll.reduce((a, p) => a + Number(p.amount), 0);
      // Expenses carry a day, not a time — put them where the day starts.
      return byHour.map((v, h) => ({
        date: format(new Date(2000, 0, 1, h), "h a"),
        revenue: Math.round(v * 100) / 100,
        expense: h === 0 ? Math.round(dayExpense * 100) / 100 : 0,
      }));
    }
    const [a, b] = from <= to ? [from, to] : [to, from];
    const dayList = eachDayOfInterval({ start: parseDay(a), end: parseDay(b) });
    // A bill's day is the shop's local day, not the UTC date in its timestamp.
    const revenueByDay = new Map<string, number>();
    for (const s of sales) {
      const k = localDay(new Date(s.created_at));
      revenueByDay.set(k, (revenueByDay.get(k) ?? 0) + Number(s.total));
    }
    return dayList.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      const dayRevenue = revenueByDay.get(key) ?? 0;
      const dayExpense =
        expenses.filter((e) => e.expense_date === key).reduce((a, e) => a + Number(e.amount), 0) +
        payroll.filter((p) => p.date === key).reduce((a, p) => a + Number(p.amount), 0);
      return { date: format(d, "MMM d"), revenue: Math.round(dayRevenue * 100) / 100, expense: Math.round(dayExpense * 100) / 100 };
    });
  }, [sales, expenses, payroll, from, to, singleDay]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    items.forEach((it) => {
      const k = it.product_name;
      const cur = map.get(k) ?? { name: k, qty: 0, revenue: 0 };
      cur.qty += Number(it.quantity);
      cur.revenue += Number(it.line_total);
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [items]);

  const paymentMix = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach((s) => map.set(s.payment_method, (map.get(s.payment_method) ?? 0) + Number(s.total)));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
  }, [sales]);

  const cashiers = useMemo(() => {
    const map = new Map<string, { id: string; revenue: number; count: number }>();
    sales.forEach((s) => {
      const cur = map.get(s.cashier_id) ?? { id: s.cashier_id, revenue: 0, count: 0 };
      cur.revenue += Number(s.total); cur.count += 1;
      map.set(s.cashier_id, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [sales]);

  const lowStock = products.filter((p) => Number(p.stock) <= Number(p.low_stock_threshold));
  const outOfStock = products.filter((p) => Number(p.stock) <= 0);
  const repeatCustomers = useMemo(() => {
    const map = new Map<string, number>();
    sales.filter((s) => s.customer_id).forEach((s) => map.set(s.customer_id, (map.get(s.customer_id) ?? 0) + 1));
    return Array.from(map.values()).filter((n) => n > 1).length;
  }, [sales]);

  const tips = useMemo(() => {
    const out: { tone: "success" | "warning" | "info"; icon: any; title: string; body: string }[] = [];
    if (outOfStock.length > 0) out.push({ tone: "warning", icon: AlertTriangle, title: t("analytics.tips.outOfStockTitle", { n: outOfStock.length }), body: t("analytics.tips.outOfStockBody", { names: outOfStock.slice(0, 3).map((p) => p.name).join(", ") + (outOfStock.length > 3 ? "…" : "") }) });
    if (lowStock.length > 0 && outOfStock.length === 0) out.push({ tone: "warning", icon: AlertTriangle, title: t("analytics.tips.lowStockTitle", { n: lowStock.length }), body: t("analytics.tips.lowStockBody", { names: lowStock.slice(0, 3).map((p) => p.name).join(", ") }) });
    if (topProducts[0]) out.push({ tone: "success", icon: Award, title: t("analytics.tips.bestsellerTitle", { name: topProducts[0].name }), body: t("analytics.tips.bestsellerBody", { revenue: formatMoney(topProducts[0].revenue, cur), qty: topProducts[0].qty }) });
    if (stats.margin > 0 && stats.margin < 20) out.push({ tone: "warning", icon: Target, title: t("analytics.tips.tightMarginTitle"), body: t("analytics.tips.tightMarginBody", { value: stats.margin.toFixed(1) }) });
    if (stats.margin >= 40) out.push({ tone: "success", icon: TrendingUp, title: t("analytics.tips.strongMarginTitle"), body: t("analytics.tips.strongMarginBody", { value: stats.margin.toFixed(1) }) });
    if (repeatCustomers === 0 && customerCount > 0) out.push({ tone: "info", icon: Users, title: t("analytics.tips.loyaltyTitle"), body: t("analytics.tips.loyaltyBody") });
    // "Slowing down" compares the last week with the window — meaningless on a short one.
    if (sales.length > 0 && days >= 14) {
      const avgDay = stats.revenue / days;
      const last7 = dailySeries.slice(-7).reduce((a, d) => a + d.revenue, 0) / 7;
      if (last7 < avgDay * 0.7) out.push({ tone: "warning", icon: TrendingUp, title: t("analytics.tips.slowingTitle"), body: t("analytics.tips.slowingBody") });
    }
    if (sales.length === 0) out.push({ tone: "info", icon: Sparkles, title: t("analytics.tips.startTitle"), body: t("analytics.tips.startBody") });
    return out;
  }, [outOfStock, lowStock, topProducts, stats, repeatCustomers, customerCount, sales, dailySeries, days, cur, formatMoney, t]);

  const guides = [
    { title: t("analytics.guides.upsellTitle"), body: t("analytics.guides.upsellBody"), category: t("analytics.guides.sales") },
    { title: t("analytics.guides.pricingTitle"), body: t("analytics.guides.pricingBody"), category: t("analytics.guides.pricing") },
    { title: t("analytics.guides.inventoryTitle"), body: t("analytics.guides.inventoryBody"), category: t("analytics.guides.inventory") },
    { title: t("analytics.guides.winbackTitle"), body: t("analytics.guides.winbackBody"), category: t("analytics.guides.retention") },
    { title: t("analytics.guides.marketingTitle"), body: t("analytics.guides.marketingBody"), category: t("analytics.guides.marketing") },
    { title: t("analytics.guides.financeTitle"), body: t("analytics.guides.financeBody"), category: t("analytics.guides.finance") },
  ];

  if (!loaded) return <div className="p-12 text-center text-muted-foreground">{t("analytics.loadingInsights")}</div>;

  const active = matchingPreset(from, to);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("analytics.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("analytics.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 p-1 bg-muted rounded-lg">
            {ANALYTICS_PRESETS.map((p) => (
              <Button
                key={p.value}
                size="sm"
                variant={active === p.value ? "default" : "ghost"}
                onClick={() => setRange(presetRange(p.value))}
                className={active === p.value ? "bg-gradient-primary text-primary-foreground" : ""}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <DateInput
              aria-label="From"
              className="h-9 w-36"
              value={from}
              onChange={(e) => { const v = e.target.value; if (DAY.test(v)) setRange((r) => ({ ...r, from: v })); }}
            />
            <span className="text-xs text-muted-foreground">to</span>
            <DateInput
              aria-label="To"
              className="h-9 w-36"
              value={to}
              onChange={(e) => { const v = e.target.value; if (DAY.test(v)) setRange((r) => ({ ...r, to: v })); }}
            />
          </div>
        </div>
      </header>
      <p className="-mt-3 text-xs text-muted-foreground">
        {singleDay ? <>Showing {fmtDate(from)}</> : <>Showing {fmtDate(from <= to ? from : to)} – {fmtDate(from <= to ? to : from)} · {days} days</>}
        {loading && <span className="ms-2 animate-pulse">Updating…</span>}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={DollarSign} label={t("analytics.netSales", { defaultValue: "Net sales" })} value={formatMoney(stats.revenue, cur)} sub={`${formatMoney(pnl.billed, cur)} billed`} tone="primary" />
        <KPI icon={TrendingUp} label={t("analytics.grossProfit")} value={formatMoney(stats.profit, cur)} sub={t("analytics.margin", { value: stats.margin.toFixed(1) })} tone="accent" />
        <KPI icon={ShoppingCart} label={t("analytics.transactions")} value={String(stats.txnCount)} sub={t("analytics.avg", { value: formatMoney(stats.avgTicket, cur) })} tone="default" />
        <KPI icon={Users} label={t("analytics.netProfit")} value={formatMoney(stats.netProfit, cur)} sub={`after ${formatMoney(stats.overheads, cur)} expenses & salaries`} tone={stats.netProfit >= 0 ? "primary" : "warning"} />
      </div>

      <ProfitExplainer pnl={pnl} format={(n) => formatMoney(n, cur)} />

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="trends">{t("analytics.tabs.trends")}</TabsTrigger>
          <TabsTrigger value="products">{t("analytics.tabs.products")}</TabsTrigger>
          <TabsTrigger value="payments">{t("analytics.tabs.payments")}</TabsTrigger>
          <TabsTrigger value="team">{t("analytics.tabs.team")}</TabsTrigger>
          <TabsTrigger value="grow"><Lightbulb className="size-3.5 mr-1.5" />{t("analytics.tabs.grow")}</TabsTrigger>
          <TabsTrigger value="guides"><BookOpen className="size-3.5 mr-1.5" />{t("analytics.tabs.guides")}</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card className="shadow-card p-5">
            <h3 className="font-semibold mb-4">{t("analytics.revenueVsExpenses")}</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} name={t("analytics.revenue")} />
                  <Line type="monotone" dataKey="expense" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} name={t("expenses.title")} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="shadow-card p-5">
              <h3 className="font-semibold mb-4">{t("analytics.topProducts")}</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="vertical" margin={{ left: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis type="category" dataKey="name" width={110} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="shadow-card p-5">
              <h3 className="font-semibold mb-3">{t("analytics.stockAlerts")}</h3>
              {lowStock.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("analytics.healthyStock")}</p>
              ) : (
                <ul className="divide-y">
                  {lowStock.slice(0, 8).map((p) => (
                    <li key={p.id} className="py-2 flex justify-between items-center">
                      <span className="text-sm font-medium truncate">{p.name}</span>
                      <span className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded ${Number(p.stock) <= 0 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                        {Number(p.stock) <= 0 ? t("analytics.out") : t("analytics.leftQty", { n: p.stock })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="shadow-card p-5">
            <h3 className="font-semibold mb-4">{t("analytics.paymentMix")}</h3>
            {paymentMix.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("analytics.noSalesRange")}</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e: any) => `${e.name} (${formatMoney(e.value, cur)})`}>
                      {paymentMix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card className="shadow-card p-5">
            <h3 className="font-semibold mb-3">{t("analytics.teamPerformance")}</h3>
            {cashiers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("analytics.noSales")}</p>
            ) : (
              <ul className="divide-y">
                {cashiers.map((c, i) => (
                  <li key={c.id} className="py-3 flex items-center gap-3">
                    <div className="size-8 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center font-bold text-sm">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-muted-foreground truncate">{c.id.slice(0, 8)}…</div>
                      <div className="text-xs text-muted-foreground">{t("analytics.salesCount", { n: c.count })}</div>
                    </div>
                    <div className="font-bold tabular-nums">{formatMoney(c.revenue, cur)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="grow" className="space-y-3">
          {tips.map((tip, i) => (
            <Card key={i} className={`shadow-card p-4 border-l-4 ${tip.tone === "success" ? "border-l-success" : tip.tone === "warning" ? "border-l-warning" : "border-l-primary"}`}>
              <div className="flex gap-3">
                <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${tip.tone === "success" ? "bg-success/10 text-success" : tip.tone === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>
                  <tip.icon className="size-4" />
                </div>
                <div>
                  <div className="font-semibold text-sm">{tip.title}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{tip.body}</div>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="guides" className="grid sm:grid-cols-2 gap-3">
          {guides.map((g, i) => (
            <Card key={i} className="shadow-card p-4 hover:shadow-elevated transition-shadow">
              <div className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">{g.category}</div>
              <h4 className="font-semibold mb-1">{g.title}</h4>
              <p className="text-sm text-muted-foreground">{g.body}</p>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KPI({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string; sub?: string; tone: "primary" | "accent" | "warning" | "default" }) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent-foreground",
    warning: "bg-warning/10 text-warning",
    default: "bg-muted text-foreground",
  };
  return (
    <Card className="shadow-card p-4">
      <div className={`size-9 rounded-lg flex items-center justify-center mb-2 ${tones[tone]}`}><Icon className="size-4" /></div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-0.5 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}
