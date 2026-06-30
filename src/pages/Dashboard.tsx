import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/contexts/ShopContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScanBarcode, Package, Receipt, AlertTriangle, TrendingUp, DollarSign, Users, PackageOpen, Wallet, BarChart3 } from "lucide-react";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { usePageMeta } from "@/hooks/usePageMeta";
import { PageTip } from "@/components/PageTip";

interface Stats {
  todaySales: number;
  todayCount: number;
  productCount: number;
  lowStock: { id: string; name: string; stock: number }[];
}

export default function Dashboard() {
  usePageMeta({ title: "Dashboard — UCU", description: "Real-time overview of your shop sales, top products, low-stock alerts and revenue trends." });
  const { currentShop } = useShop();
  const perms = usePermissions();
  const { t } = useTranslation();
  const formatMoney = useFormatMoney();
  const [stats, setStats] = useState<Stats>({ todaySales: 0, todayCount: 0, productCount: 0, lowStock: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = `${t("nav.dashboard")} — UCU`; }, [t]);

  useEffect(() => {
    if (!currentShop) return;
    (async () => {
      setLoading(true);
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [{ data: salesToday }, { count: productCount }, { data: products }] = await Promise.all([
        supabase.from("sales").select("total").eq("shop_id", currentShop.id).gte("created_at", startOfDay.toISOString()),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("shop_id", currentShop.id).eq("is_active", true),
        supabase.from("products").select("id, name, stock, low_stock_threshold").eq("shop_id", currentShop.id).eq("is_active", true),
      ]);

      const todaySales = (salesToday ?? []).reduce((a, s) => a + Number(s.total), 0);
      const lowStock = (products ?? [])
        .filter((p) => Number(p.stock) <= Number(p.low_stock_threshold))
        .slice(0, 5)
        .map((p) => ({ id: p.id, name: p.name, stock: Number(p.stock) }));

      setStats({
        todaySales,
        todayCount: salesToday?.length ?? 0,
        productCount: productCount ?? 0,
        lowStock,
      });
      setLoading(false);
    })();
  }, [currentShop]);

  const cur = currentShop?.currency ?? "USD";

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
        <StatCard icon={DollarSign} label={t("dashboard.todayRevenue")} value={formatMoney(stats.todaySales, cur)} tone="primary" />
        <StatCard icon={Receipt} label={t("dashboard.todaySales")} value={String(stats.todayCount)} tone="accent" />
        <StatCard icon={Package} label={t("dashboard.activeProducts")} value={String(stats.productCount)} tone="default" />
        <StatCard icon={AlertTriangle} label={t("dashboard.lowStock")} value={String(stats.lowStock.length)} tone="warning" />
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
          ) : stats.lowStock.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">{t("dashboard.lowStockEmpty")} ✨</div>
          ) : (
            <ul className="space-y-2">
              {stats.lowStock.map((p) => (
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
