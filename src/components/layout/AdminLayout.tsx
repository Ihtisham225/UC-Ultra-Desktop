import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useShop } from "@/contexts/ShopContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { isMacDesktop } from "@/components/TitleBar";
import {
  ShieldAlert, Store, LogOut, ChevronDown, LayoutDashboard, Users, Building2,
  ScrollText, Megaphone, TrendingUp, CreditCard, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The admin area is a set of real ROUTES rather than tabs on one page — each
 * section carries its own filters and paging, and a tab strip cannot be
 * linked to or reloaded back into the state you were reading. Kept in step
 * with the web app's own AdminLayout.
 */
const NAV: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/revenue", label: "Revenue", icon: TrendingUp },
  { to: "/admin/shops", label: "Stores", icon: Building2 },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/audit", label: "Audit log", icon: ScrollText },
  { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { to: "/admin/plans", label: "Plans", icon: CreditCard },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function NavLinks() {
  const { pathname } = useLocation();
  return (
    <nav className="space-y-0.5">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Dedicated shell for the super-admin area — deliberately separate from the
 * store's AppLayout (no POS sidebar). A super admin lands here on sign-in and
 * can drop into any store they belong to via "Open store".
 */
export const AdminLayout = ({ children }: { children: ReactNode }) => {
  const { user, signOut } = useAuth();
  const { shops, setCurrentShopId } = useShop();
  const navigate = useNavigate();

  const openStore = async (shopId: string) => {
    try {
      await setCurrentShopId(shopId);
      navigate("/pos");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open the store");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-surface flex flex-col">
      <header className="drag-region sticky top-0 z-20 border-b bg-card/80 backdrop-blur">
        <div className="px-4 h-14 flex items-center gap-3">
          {/* Traffic-light spacer — with px-4 this matches AppLayout's 5.5rem inset */}
          {isMacDesktop() && <div className="w-[4.5rem] shrink-0" aria-hidden="true" />}
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <span className="font-bold leading-none">UC Ultra</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              <ShieldAlert className="size-3" /> Admin
            </span>
          </div>

          <div className="no-drag-region ms-auto flex items-center gap-1.5">
            {shops.length === 1 ? (
              <Button variant="outline" size="sm" onClick={() => openStore(shops[0].id)}>
                <Store className="size-4 me-1.5" /> Open {shops[0].name}
              </Button>
            ) : shops.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Store className="size-4 me-1.5" /> Open a store <ChevronDown className="size-3.5 ms-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Your stores</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {shops.map((s) => (
                    <DropdownMenuItem key={s.id} onClick={() => openStore(s.id)}>
                      <Store className="size-4 me-2" /> {s.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            <LanguageToggle />
            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <span className="size-7 rounded-full bg-gradient-primary text-primary-foreground grid place-items-center text-xs font-bold uppercase">
                    {(user?.display_name || user?.email || "?").slice(0, 1)}
                  </span>
                  <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user?.display_name || user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive">
                  <LogOut className="size-4 me-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        <aside className="hidden lg:block w-56 shrink-0 border-e bg-card/40 p-3">
          <div className="sticky top-[4.5rem]">
            <NavLinks />
          </div>
        </aside>
        <main className="flex-1 min-w-0 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
};
