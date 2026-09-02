import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useShop } from "@/contexts/ShopContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScanBarcode, Package, Receipt, AlertTriangle, TrendingUp, DollarSign, Users, PackageOpen, Wallet, BarChart3 } from "lucide-react";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { usePageMeta } from "@/hooks/usePageMeta";
import { PageTip } from "@/components/PageTip";
import { useLocalStore } from "@/hooks/useLocalStore";
import { useProductsWithVariants } from "@/hooks/useProductsWithVariants";
import { useState } from "react";
import { rpc } from "@/lib/apiClient";
import { isHandicraft } from "@/lib/handicraft";
import HandicraftDashboard from "@/components/HandicraftDashboard";
import type { CraftDashboard } from "@/lib/handicraftTypes";

export default function Dashboard() {
  usePageMeta({ title: "Dashboard — UCU", description: "Real-time overview of your shop sales, top products, low-stock alerts and revenue trends." });
  const { currentShop } = useShop();
  const perms = usePermissions();
  const { t } = useTranslation();
  const formatMoney = useFormatMoney();

  useEffect(() => { document.title = `${t("nav.dashboard")} — UCU`; }, [t]);

  // A handicraft shop has no sales and no stock — its figures come from the
  // server, since none of the register lives in the offline store.
  const craft = isHandicraft(currentShop);
  const [craftStats, setCraftStats] = useState<CraftDashboard | null>(null);
  const [craftError, setCraftError] = useState<string | null>(null);
  useEffect(() => {
    if (!craft || !currentShop) return;
    let cancelled = false;
    rpc<CraftDashboard>("loadCraftDashboardAction")
      .then((d) => { if (!cancelled) { setCraftStats(d); setCraftError(null); } })
      .catch((e) => { if (!cancelled) setCraftError(e instanceof Error ? e.message : "Failed to load"); });
    return () => { cancelled = true; };
  }, [craft, currentShop]);

  const { data: allSales, loading: salesLoading } = useLocalStore<any>("sales", currentShop?.id);
  const { data: allProducts, loading: productsLoading } = useProductsWithVariants<any>(currentShop?.id);
  // Today's spending, buying and margin. All three come from the offline store
  // so the tiles still read correctly on a till with no connection.
  const { data: allSaleItems } = useLocalStore<any>("sale_items", currentShop?.id);
  const { data: allExpenses } = useLocalStore<any>("expenses", currentShop?.id);
  const { data: allPurchases } = useLocalStore<any>("purchases", currentShop?.id);
  const { data: allPurchaseItems } = useLocalStore<any>("purchase_items", currentShop?.id);

  const loading = salesLoading || productsLoading;

  const safeStats = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todaySales = allSales
      .filter((s) => s.created_at && new Date(s.created_at) >= startOfDay)
      .reduce((a: number, s: any) => a + Number(s.total ?? 0), 0);
    const todayCount = allSales.filter((s) => s.created_at && new Date(s.created_at) >= startOfDay).length;
    const activeProducts = allProducts.filter((p: any) => p.is_active !== false);
    // Variant products track stock per variant — alert per low variant, and
    // only use the parent row's stock for simple products.
    const lowStock: { id: string; name: string; stock: number }[] = [];
    for (const p of activeProducts) {
      const variants = (p.product_variants ?? []).filter((v: any) => v.is_active !== false);
      if (variants.length > 0) {
        for (const v of variants) {
          const threshold = Number(v.low_stock_threshold ?? p.low_stock_threshold ?? 5);
          if (Number(v.stock) <= threshold) {
            lowStock.push({ id: v.id, name: `${p.name} — ${v.name}`, stock: Number(v.stock) });
          }
        }
      } else if (Number(p.stock) <= Number(p.low_stock_threshold ?? 5)) {
        lowStock.push({ id: p.id, name: p.name, stock: Number(p.stock) });
      }
    }
    lowStock.sort((a, b) => a.stock - b.stock);

    // expense_date is a plain date, so compare on the day rather than the
    // instant — an instant comparison drops everything dated today.
    const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const todayKey = dayKey(startOfDay);
    const todayExpenses = allExpenses
      .filter((e: any) => String(e.expense_date ?? "").slice(0, 10) === todayKey)
      .reduce((a: number, e: any) => a + Number(e.amount ?? 0), 0);

    const todayPurchases = allPurchases
      .filter((p: any) => p.created_at && new Date(p.created_at) >= startOfDay)
      .reduce((a: number, p: any) => a + Number(p.total ?? 0), 0);

    // Average landed cost per product, on the same basis the P&L report uses,
    // so the tile and the report can never disagree. A product never purchased
    // through the app contributes no cost and so flatters the margin — the
    // same assumption the report makes.
    const costQty = new Map<string, { cost: number; qty: number }>();
    for (const pi of allPurchaseItems) {
      const key = pi.product_id;
      if (!key) continue;
      const acc = costQty.get(key) ?? { cost: 0, qty: 0 };
      acc.cost += Number(pi.quantity ?? 0) * Number(pi.unit_cost ?? 0) + Number(pi.expense_amount ?? 0);
      acc.qty += Number(pi.quantity ?? 0);
      costQty.set(key, acc);
    }
    const todaySaleIds = new Set(
      allSales.filter((s: any) => s.created_at && new Date(s.created_at) >= startOfDay).map((s: any) => s.id),
    );
    const todayCogs = allSaleItems
      .filter((si: any) => todaySaleIds.has(si.sale_id))
      .reduce((a: number, si: any) => {
        const c = costQty.get(si.product_id);
        const avg = c && c.qty > 0 ? c.cost / c.qty : 0;
        return a + Number(si.quantity ?? 0) * avg;
      }, 0);

    return {
      todaySales,
      todayCount,
      productCount: activeProducts.length,
      lowStock: lowStock.slice(0, 5),
      todayExpenses,
      todayPurchases,
      todayGrossProfit: Math.round((todaySales - todayCogs) * 100) / 100,
    };
  }, [allSales, allProducts, allSaleItems, allExpenses, allPurchases, allPurchaseItems]);

  const cur = currentShop?.currency ?? "USD";

  if (craft) {
    if (craftError) {
      return (
        <div className="max-w-2xl mx-auto p-12 text-center space-y-2">
          <p className="text-muted-foreground">{craftError}</p>
          <p className="text-sm text-muted-foreground">
            The register needs an internet connection — it isn&apos;t kept on this machine.
          </p>
        </div>
      );
    }
    if (!craftStats) {
      return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
    }
    return <HandicraftDashboard stats={craftStats} />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("dashboard.welcome")}{currentShop ? ` — ${currentShop.name}` : ""}</h1>
          <p className="text-muted-foreground mt-1">{t("dashboard.growTipBody").split(".")[0]}.</p>
        </div>
        <Button asChild size="lg" className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow">
          <Link to="/pos"><ScanBarcode className="size-4 me-2" /> {t("nav.pos")}</Link>
        </Button>
      </header>

      <PageTip id="dashboard.flow" title="The 4-step flow of UCU">
        Add <b>Products</b> → record <b>Purchases</b> when stock arrives → ring up sales at <b>POS</b> → review <b>Analytics</b>.
        Anything unpaid from a sale is tracked under <b>Debts</b>. Tap the <b>?</b> in the top bar to re-open the full guide.
      </PageTip>




      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={DollarSign} label={t("dashboard.todayRevenue")} value={formatMoney(safeStats.todaySales, cur)} tone="primary" />
        <StatCard icon={Receipt} label={t("dashboard.todaySales")} value={String(safeStats.todayCount)} tone="accent" />
        <StatCard icon={Package} label={t("dashboard.activeProducts")} value={String(safeStats.productCount)} tone="default" />
        <StatCard icon={AlertTriangle} label={t("dashboard.lowStock")} value={String(safeStats.lowStock.length)} tone="warning" />
        <StatCard
          icon={TrendingUp}
          label={t("dashboard.todayGrossProfit", { defaultValue: "Today's gross profit" })}
          value={formatMoney(safeStats.todayGrossProfit, cur)}
          tone={safeStats.todayGrossProfit < 0 ? "warning" : "primary"}
        />
        <StatCard
          icon={PackageOpen}
          label={t("dashboard.todayPurchases", { defaultValue: "Today's purchases" })}
          value={formatMoney(safeStats.todayPurchases, cur)}
          tone="default"
        />
        <StatCard
          icon={Wallet}
          label={t("dashboard.todayExpenses", { defaultValue: "Today's expenses" })}
          value={formatMoney(safeStats.todayExpenses, cur)}
          tone="default"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {perms.canManageExpenses && (
          <Button asChild variant="outline" size="sm"><Link to="/analytics"><BarChart3 className="size-4 me-2" />{t("nav.analytics")}</Link></Button>
        )}
        <Button asChild variant="outline" size="sm"><Link to="/customers"><Users className="size-4 me-2" />{t("nav.customers")}</Link></Button>
        {perms.canManagePurchases && (
          <Button asChild variant="outline" size="sm"><Link to="/purchases"><PackageOpen className="size-4 me-2" />{t("nav.purchases")}</Link></Button>
        )}
        {perms.canManageExpenses && (
          <Button asChild variant="outline" size="sm"><Link to="/expenses"><Wallet className="size-4 me-2" />{t("nav.expenses")}</Link></Button>
        )}
        <Button asChild variant="outline" size="sm"><Link to="/products"><Package className="size-4 me-2" />{t("nav.products")}</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/sales"><Receipt className="size-4 me-2" />{t("nav.sales")}</Link></Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><AlertTriangle className="size-4 text-warning" /> {t("dashboard.lowStockAlert")}</h2>
            <Button asChild size="sm" variant="ghost"><Link to="/products">{t("common.view")}</Link></Button>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : safeStats.lowStock.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">{t("dashboard.lowStockEmpty")} ✨</div>
          ) : (
            <ul className="space-y-2">
              {safeStats.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/20">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-sm font-mono text-warning font-semibold">{p.stock}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6 shadow-card bg-gradient-primary text-primary-foreground">
          <h2 className="font-semibold flex items-center gap-2 mb-2"><TrendingUp className="size-4" /> {t("dashboard.growTip")}</h2>
          <p className="text-sm opacity-95 mb-4">{t("dashboard.growTipBody")}</p>
          <Button asChild variant="secondary" size="sm">
            <Link to="/customers">{t("dashboard.addCustomer")}</Link>
          </Button>
        </Card>
      </div>

    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: "primary" | "accent" | "warning" | "default" }) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent-foreground",
    warning: "bg-warning/10 text-warning",
    default: "bg-muted text-foreground",
  };
  return (
    <Card className="p-5 shadow-card min-w-0">
      <div className={`size-10 rounded-lg flex items-center justify-center mb-3 ${tones[tone]}`}>
        <Icon className="size-5" />
      </div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium truncate">{label}</div>
      <div className="text-lg sm:text-2xl font-bold mt-1 break-words leading-tight">{value}</div>
    </Card>
  );
}
