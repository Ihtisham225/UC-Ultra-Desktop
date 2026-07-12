import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
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
import { ShieldAlert, Store, LogOut, ChevronDown } from "lucide-react";

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

      <main className="flex-1 container mx-auto p-4 lg:p-8">{children}</main>
    </div>
  );
};
