import { ReactNode, useEffect, useState } from "react";
import { NavLink, useLocation, Link } from "react-router-dom";
import { LayoutDashboard, ScanBarcode, Package, Users, Receipt, Settings, LogOut, Store, ChevronDown, PackageOpen, Wallet, ShieldCheck, BarChart3, Sparkles, ShieldAlert, Undo2, LifeBuoy, HandCoins, Truck, Calculator, FileBarChart, Boxes, HelpCircle } from "lucide-react";
import { WelcomeTour } from "@/components/WelcomeTour";
import { FloatingCalculator, type CalculatorState } from "@/components/FloatingCalculator";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useShop } from "@/contexts/ShopContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useProAccess } from "@/hooks/useProAccess";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ProBadge } from "@/components/ProBadge";

import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { GlobalSearch } from "@/components/GlobalSearch";
import { InstallPwaButton } from "@/components/InstallPwaButton";
import { Logo } from "@/components/Logo";

type NavItem = { to: string; label: string; icon: any; show: boolean };

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, signOut } = useAuth();
  const { shops, currentShop, setCurrentShopId, role } = useShop();
  const perms = usePermissions();
  const { isPro, daysLeft } = useProAccess();
  const { isSuperAdmin } = useIsSuperAdmin();
  const { t } = useTranslation();
  const loc = useLocation();
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcState, setCalcState] = useState<CalculatorState>({ expr: "", display: "0" });
  const [tourOpen, setTourOpen] = useState(false);

  // Auto-open the welcome tour the first time a user signs in
  useEffect(() => {
    if (!user) return;
    try {
      if (!localStorage.getItem(`ucu.tour.seen.${user.id}`)) {
        const t = setTimeout(() => setTourOpen(true), 600);
        return () => clearTimeout(t);
      }
    } catch {}
  }, [user]);

  const nav: NavItem[] = [
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
    { to: "/settings", label: t("nav.settings"), icon: Settings, show: true },
    { to: "/support", label: t("nav.support"), icon: LifeBuoy, show: true },
  ].filter((n) => n.show);

  const renderItem = (item: NavItem, mobile = false) => {
    const active = loc.pathname === item.to || (item.to !== "/" && loc.pathname.startsWith(item.to));

    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={cn(
          mobile
            ? cn("p-2 rounded-md shrink-0", active ? "bg-primary text-primary-foreground" : "text-muted-foreground")
            : cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )
        )}
      >
        <item.icon className="size-4" />
        {!mobile && item.label}
      </NavLink>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Full-width titlebar / header ── */}
      <header
        className="drag-region border-b bg-card/90 backdrop-blur-sm sticky top-0 z-30 shrink-0"
      >
        {/* The flex row is NOT no-drag — only individual interactive elements are */}
        <div className="flex items-center gap-3 h-14">
          {/* Traffic-light spacer — drag region passes through here */}
          <div className="hidden lg:block w-[5.5rem] shrink-0" />

          {/* Brand — static, draggable */}
          <div className="no-drag-region hidden lg:flex items-center gap-2.5 shrink-0 pe-2 border-r border-border mr-1">
            <Logo size="sm" />
            <div className="leading-tight">
              <div className="font-bold text-sm">{t("app.name")}</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{t("app.tagline")}</div>
            </div>
          </div>

          {/* Mobile brand */}
          <div className="no-drag-region lg:hidden flex items-center gap-2 pl-4 shrink-0">
            <Logo size="sm" />
          </div>

          {/* Shop switcher */}
          <div className="no-drag-region flex items-center gap-2 min-w-0 pl-2 lg:pl-0">
            {role === "owner" ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 min-w-0 max-w-[200px]">
                    <Store className="size-4 text-primary shrink-0" />
                    <span className="font-semibold truncate">{currentShop?.name ?? t("layout.selectShop")}</span>
                    {role && <span className="hidden sm:inline-flex text-[10px] uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold shrink-0">{t(`staff.${role}` as const, { defaultValue: role })}</span>}
                    <ChevronDown className="size-3.5 opacity-50 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>{t("layout.yourShops")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {shops.map((s) => (
                    <DropdownMenuItem key={s.id} onClick={() => setCurrentShopId(s.id)}>
                      <Store className="size-4 me-2" /> {s.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <NavLink to="/onboarding">{t("layout.createShop")}</NavLink>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border min-w-0 max-w-full">
                <Store className="size-4 text-primary shrink-0" />
                <span className="font-semibold truncate">{currentShop?.name ?? ""}</span>
                {role && <span className="hidden sm:inline-flex text-[10px] uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold shrink-0">{t(`staff.${role}` as const, { defaultValue: role })}</span>}
              </div>
            )}
          </div>

          {/* Global search — centred flex-1, draggable gaps on either side */}
          <div className="no-drag-region hidden lg:flex flex-1 justify-center px-4">
            <GlobalSearch variant="desktop-bar" />
          </div>

          {/* Right actions */}
          <div className="no-drag-region flex items-center gap-0.5 shrink-0 pr-3 ml-auto lg:ml-0">
            <Button variant="ghost" size="icon" onClick={() => setCalcOpen(true)} aria-label="Calculator">
              <Calculator className="size-4.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setTourOpen(true)} aria-label="Guide">
              <HelpCircle className="size-4.5" />
            </Button>
            <LanguageToggle />
            <ThemeToggle />
            <InstallPwaButton />
          </div>
        </div>
      </header>

      {isPro && daysLeft > 0 && daysLeft <= 10 && (
        <div className="px-4 lg:px-8 pt-3 shrink-0">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 px-4 py-2.5 text-sm flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 shrink-0" />
              <span>Your subscription expires in <b>{daysLeft} day{daysLeft === 1 ? "" : "s"}</b>. Please contact <b>Tech Town Swat</b> to renew.</span>
            </div>
            <Link to="/support" className="text-xs font-semibold underline underline-offset-2 hover:opacity-80">Contact support</Link>
          </div>
        </div>
      )}

      {/* ── Body: sidebar + main ── */}
      <div className="flex flex-1 min-h-0">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-sidebar text-sidebar-foreground border-r border-sidebar-border shrink-0">
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => renderItem(item))}
          {isSuperAdmin && (
            <NavLink to="/admin" className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}>
              <ShieldAlert className="size-4" /> {t("nav.adminDashboard")}
            </NavLink>
          )}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          {isPro && role === "owner" && (
            <Link to="/billing" className="block rounded-lg p-3 bg-success/10 border border-success/20 hover:bg-success/15 transition-colors">
              <div className="flex items-center gap-1.5 text-xs font-bold text-success"><Sparkles className="size-3.5" /> {t("layout.subscriptionActive")}</div>
              <div className="text-[11px] text-sidebar-foreground/70 mt-0.5">{t("common.daysLeft", { count: daysLeft })}</div>
            </Link>
          )}
          <div className="px-3 py-2 text-xs">
            <div className="text-sidebar-foreground/60">{t("layout.signedInAs")}</div>
            <div className="font-medium truncate">{user?.email}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="size-4 me-2" /> {t("common.signOut")}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8">{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileBottomNav />

      <FloatingCalculator
        open={calcOpen}
        onMinimize={() => setCalcOpen(false)}
        state={calcState}
        setState={setCalcState}
      />

      <WelcomeTour open={tourOpen} onOpenChange={setTourOpen} />
    </div>
  );
};
