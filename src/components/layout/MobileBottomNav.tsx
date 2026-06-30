import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, ScanBarcode, Menu, Settings as SettingsIcon, Package, Receipt, Users, BarChart3, PackageOpen, Wallet, ShieldCheck, ShieldAlert, Sparkles, LogOut, Undo2, LifeBuoy, HandCoins, Truck, FileBarChart, Boxes } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useProAccess } from "@/hooks/useProAccess";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";

import { GlobalSearch } from "@/components/GlobalSearch";

type NavItem = { to: string; label: string; icon: any; show: boolean };

export const MobileBottomNav = () => {
  const loc = useLocation();
  const { signOut, user } = useAuth();
  const perms = usePermissions();
  const { isPro, daysLeft } = useProAccess();
  const { isSuperAdmin } = useIsSuperAdmin();
  const { t } = useTranslation();

  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (to: string) => loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to));

  const allNav: NavItem[] = [
    { to: "/", label: t("nav.dashboard"), icon: LayoutDashboard, show: true },
    { to: "/pos", label: t("nav.pos"), icon: ScanBarcode, show: true },
    { to: "/products", label: t("nav.products"), icon: Package, show: true },
    { to: "/inventory", label: "Inventory", icon: Boxes, show: perms.canManageProducts },
    { to: "/sales", label: t("nav.sales"), icon: Receipt, show: true },
    { to: "/returns", label: t("nav.returns"), icon: Undo2, show: true },
    { to: "/customers", label: t("nav.customers"), icon: Users, show: true },
    { to: "/analytics", label: t("nav.analytics"), icon: BarChart3, show: perms.canManageExpenses },
    { to: "/reports", label: "Reports", icon: FileBarChart, show: perms.canManageExpenses },
    { to: "/purchases", label: t("nav.purchases"), icon: PackageOpen, show: perms.canManagePurchases },
    { to: "/suppliers", label: t("nav.suppliers"), icon: Truck, show: perms.canManageSuppliers },
    { to: "/expenses", label: t("nav.expenses"), icon: Wallet, show: perms.canManageExpenses },
    { to: "/debts", label: t("nav.debts"), icon: HandCoins, show: perms.canManageExpenses },
    { to: "/staff", label: t("nav.staff"), icon: ShieldCheck, show: perms.canManageStaff },
  ].filter((n) => n.show);

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border safe-area-bottom">
        <div className="grid grid-cols-4 h-16">
          <Link
            to="/"
            className={cn(
              "flex flex-col items-center justify-center gap-1 transition-colors",
              isActive("/") ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutDashboard className="size-5" />
            <span className="text-[10px] font-medium">{t("nav.dashboard")}</span>
          </Link>

          <Link to="/pos" className="flex flex-col items-center justify-center gap-1">
            <div className={cn(
              "size-12 -mt-5 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95",
              isActive("/pos") ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-primary text-primary-foreground"
            )}>
              <ScanBarcode className="size-6" />
            </div>
            <span className={cn("text-[10px] font-medium", isActive("/pos") ? "text-primary" : "text-muted-foreground")}>{t("nav.pos")}</span>
          </Link>

          <div className="flex items-center justify-center">
            <GlobalSearch variant="mobile-icon" />
          </div>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button className={cn(
                "flex flex-col items-center justify-center gap-1 transition-colors",
                menuOpen ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}>
                <Menu className="size-5" />
                <span className="text-[10px] font-medium">{t("common.open")}</span>
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[88vw] max-w-sm p-0 flex flex-col gap-0 border-l">
              <SheetHeader
                className="px-5 border-b text-start bg-card/95 backdrop-blur-xl shrink-0"
                style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)", paddingBottom: "0.875rem" }}
              >
                <SheetTitle className="text-base">{t("common.open")}</SheetTitle>
                <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-1">
                {allNav.map((item) => {
                  const active = isActive(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-medium transition-colors",
                        active ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-muted active:bg-muted"
                      )}
                    >
                      <item.icon className="size-[18px]" />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}

                {isSuperAdmin && (
                  <>
                    <div className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("nav.adminDashboard")}</div>
                    <Link to="/admin" onClick={() => setMenuOpen(false)}
                      className={cn("flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-medium transition-colors",
                        isActive("/admin") && !isActive("/admin/payments") ? "bg-primary text-primary-foreground" : "hover:bg-muted active:bg-muted")}>
                      <ShieldAlert className="size-[18px]" /> {t("nav.adminDashboard")}
                    </Link>
                    <Link to="/admin/payments" onClick={() => setMenuOpen(false)}
                      className={cn("flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-medium transition-colors",
                        isActive("/admin/payments") ? "bg-primary text-primary-foreground" : "hover:bg-muted active:bg-muted")}>
                      <ShieldCheck className="size-[18px]" /> {t("nav.adminPayments")}
                    </Link>
                  </>
                )}
              </div>

              <div className="border-t p-3 space-y-2 bg-card/95 backdrop-blur-xl shrink-0"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
                {isPro && (
                  <Link to="/billing" onClick={() => setMenuOpen(false)}
                    className="block rounded-xl p-3 bg-success/10 border border-success/20 active:scale-[0.98] transition-transform">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-success"><Sparkles className="size-3.5" /> {t("layout.subscriptionActive")}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{t("common.daysLeft", { count: daysLeft })}</div>
                  </Link>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/settings" onClick={() => setMenuOpen(false)}
                    className={cn("flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                      isActive("/settings") ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80")}>
                    <SettingsIcon className="size-4" /> {t("nav.settings")}
                  </Link>
                  <Link to="/support" onClick={() => setMenuOpen(false)}
                    className={cn("flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                      isActive("/support") ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80")}>
                    <LifeBuoy className="size-4" /> {t("nav.support")}
                  </Link>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setMenuOpen(false); signOut(); }}
                  className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10">
                  <LogOut className="size-4 me-2" /> {t("common.signOut")}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      
    </>
  );
};
