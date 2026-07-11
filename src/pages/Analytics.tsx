import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAll } from "@/lib/localDb";
import { useShop } from "@/contexts/ShopContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TrendingUp, DollarSign, ShoppingCart, Users, Lightbulb, BookOpen, AlertTriangle, Award, Target, Sparkles } from "lucide-react";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { usePageMeta } from "@/hooks/usePageMeta";

type Range = 7 | 30 | 90;

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))"];

export default function Analytics() {
  usePageMeta({ title: "Analytics — UCU", description: "Visual reports on revenue, profit, top products and best customers.", path: "/analytics" });
  const { t } = useTranslation();
  const { currentShop } = useShop();
  const formatMoney = useFormatMoney();
  const perms = usePermissions();
  const [range, setRange] = useState<Range>(30);
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  /** Weighted average cost per product_id or variant_id, derived from all purchase_items. */
  const [avgCost, setAvgCost] = useState<Map<string, number>>(new Map());
  const [customerCount, setCustomerCount] = useState(0);

  useEffect(() => { document.title = "UCU"; }, []);

  useEffect(() => {
    if (!currentShop) return;
    (async () => {
      setLoading(true);
      const since = startOfDay(subDays(new Date(), range)).toISOString();
      const shopId = currentShop.id;
      // Read from the local sync store — offline-capable, all these tables sync.
      const [allSales, allSaleItems, allProducts, allExpenses, allCustomers, allPurchaseItems] = await Promise.all([
        getAll<any>("sales", shopId),
        getAll<any>("sale_items", shopId),
        getAll<any>("products", shopId),
        perms.canManageExpenses ? getAll<any>("expenses", shopId) : Promise.resolve([] as any[]),
        getAll<any>("customers", shopId),
        getAll<any>("purchase_items", shopId),
      ]);
      const itemsBySale = new Map<string, any[]>();
      for (const it of allSaleItems) {
        const arr = itemsBySale.get(it.sale_id) ?? [];
        arr.push(it);
        itemsBySale.set(it.sale_id, arr);
      }
      const salesData = allSales
        .filter((sl) => sl.created_at >= since)
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
        .map((sl) => ({ ...sl, sale_items: itemsBySale.get(sl.id) ?? [] }));
      setSales(salesData);
      setItems(salesData.flatMap((sl: any) => (sl.sale_items ?? []).map((it: any) => ({ ...it, created_at: sl.created_at }))));
      setProducts(allProducts.filter((p) => p.is_active !== false));
      setExpenses(allExpenses.filter((e) => String(e.expense_date) >= since.slice(0, 10)));
      setCustomerCount(allCustomers.length);

      // Build weighted average cost: key = variant_id || product_id.
      const totals = new Map<string, { qty: number; cost: number }>();
      (allPurchaseItems as any[]).forEach((row) => {
        const key = row.variant_id ?? row.product_id;
        if (!key) return;
        const qty = Number(row.quantity);
        const unitCost = Number(row.unit_cost);
        const cur = totals.get(key) ?? { qty: 0, cost: 0 };
        cur.qty += qty;
        cur.cost += qty * unitCost;
        totals.set(key, cur);
      });
      const avg = new Map<string, number>();
      totals.forEach((v, k) => avg.set(k, v.qty > 0 ? v.cost / v.qty : 0));
      setAvgCost(avg);

      setLoading(false);
    })();
  }, [currentShop, range, perms.canManageExpenses]);

  const cur = currentShop?.currency ?? "USD";

  const stats = useMemo(() => {
    const revenue = sales.reduce((a, s) => a + Number(s.total), 0);
    const subtotal = sales.reduce((a, s) => a + Number(s.subtotal), 0);
    // COGS = sum over sold items of qty × weighted-avg purchase cost for that variant/product.
    const cogs = items.reduce((a, it) => {
      const key = it.variant_id ?? it.product_id;
      const unit = key ? avgCost.get(key) ?? 0 : 0;
      return a + Number(it.quantity) * unit;
    }, 0);
    const profit = subtotal - cogs;
    const margin = subtotal > 0 ? (profit / subtotal) * 100 : 0;
    const txnCount = sales.length;
    const avgTicket = txnCount > 0 ? revenue / txnCount : 0;
    const totalExpenses = expenses.reduce((a, e) => a + Number(e.amount), 0);
    const netProfit = revenue - totalExpenses;
    return { revenue, subtotal, profit, margin, txnCount, avgTicket, totalExpenses, netProfit, cogs };
  }, [sales, items, expenses, avgCost]);

  const dailySeries = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), range - 1), end: new Date() });
    return days.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      const dayRevenue = sales.filter((s) => s.created_at.slice(0, 10) === key).reduce((a, s) => a + Number(s.total), 0);
      const dayExpense = expenses.filter((e) => e.expense_date === key).reduce((a, e) => a + Number(e.amount), 0);
      return { date: format(d, "MMM d"), revenue: Math.round(dayRevenue * 100) / 100, expense: Math.round(dayExpense * 100) / 100 };
    });
  }, [sales, expenses, range]);

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
    if (sales.length > 0) {
      const avgDay = stats.revenue / range;
      const last7 = dailySeries.slice(-7).reduce((a, d) => a + d.revenue, 0) / 7;
      if (last7 < avgDay * 0.7) out.push({ tone: "warning", icon: TrendingUp, title: t("analytics.tips.slowingTitle"), body: t("analytics.tips.slowingBody") });
    }
    if (sales.length === 0) out.push({ tone: "info", icon: Sparkles, title: t("analytics.tips.startTitle"), body: t("analytics.tips.startBody") });
    return out;
  }, [outOfStock, lowStock, topProducts, stats, repeatCustomers, customerCount, sales, dailySeries, range, cur, formatMoney, t]);

  const guides = [
    { title: t("analytics.guides.upsellTitle"), body: t("analytics.guides.upsellBody"), category: t("analytics.guides.sales") },
    { title: t("analytics.guides.pricingTitle"), body: t("analytics.guides.pricingBody"), category: t("analytics.guides.pricing") },
    { title: t("analytics.guides.inventoryTitle"), body: t("analytics.guides.inventoryBody"), category: t("analytics.guides.inventory") },
    { title: t("analytics.guides.winbackTitle"), body: t("analytics.guides.winbackBody"), category: t("analytics.guides.retention") },
    { title: t("analytics.guides.marketingTitle"), body: t("analytics.guides.marketingBody"), category: t("analytics.guides.marketing") },
    { title: t("analytics.guides.financeTitle"), body: t("analytics.guides.financeBody"), category: t("analytics.guides.finance") },
  ];

  if (loading) return <div className="p-12 text-center text-muted-foreground">{t("analytics.loadingInsights")}</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("analytics.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("analytics.subtitle")}</p>
        </div>
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {[7, 30, 90].map((r) => (
            <Button key={r} size="sm" variant={range === r ? "default" : "ghost"} onClick={() => setRange(r as Range)} className={range === r ? "bg-gradient-primary text-primary-foreground" : ""}>
              {r}d
            </Button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={DollarSign} label={t("analytics.revenue")} value={formatMoney(stats.revenue, cur)} tone="primary" />
        <KPI icon={TrendingUp} label={t("analytics.grossProfit")} value={formatMoney(stats.profit, cur)} sub={t("analytics.margin", { value: stats.margin.toFixed(1) })} tone="accent" />
        <KPI icon={ShoppingCart} label={t("analytics.transactions")} value={String(stats.txnCount)} sub={t("analytics.avg", { value: formatMoney(stats.avgTicket, cur) })} tone="default" />
        <KPI icon={Users} label={t("analytics.netProfit")} value={formatMoney(stats.netProfit, cur)} sub={t("analytics.expBrief", { value: formatMoney(stats.totalExpenses, cur) })} tone={stats.netProfit >= 0 ? "primary" : "warning"} />
      </div>

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
