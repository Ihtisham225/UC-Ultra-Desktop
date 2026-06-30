import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export type ShopRole = "owner" | "manager" | "cashier";

export interface Shop {
  id: string;
  name: string;
  currency: string;
  tax_rate: number;
  receipt_footer: string | null;
  receipt_header: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  show_tax_line: boolean;
  notify_low_stock: boolean;
  notify_daily_summary: boolean;
  is_pro: boolean;
  pro_until: string | null;
  created_by: string;
}

interface ShopContextValue {
  shops: Shop[];
  currentShop: Shop | null;
  role: ShopRole | null;
  loading: boolean;
  permissions: Set<string>;
  hasPerm: (module: string, action: string) => boolean;
  setCurrentShopId: (id: string) => void;
  refresh: () => Promise<void>;
}

const ShopContext = createContext<ShopContextValue | undefined>(undefined);
const STORAGE_KEY = "pos.currentShopId";

export const ShopProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [role, setRole] = useState<ShopRole | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadPermsFor = useCallback(async (shopId: string) => {
    if (!user) { setPermissions(new Set()); return; }
    const { data: assigns } = await supabase
      .from("shop_user_role_assignments")
      .select("role_id")
      .eq("shop_id", shopId)
      .eq("user_id", user.id);
    const roleIds = (assigns ?? []).map((a: any) => a.role_id);
    if (!roleIds.length) { setPermissions(new Set()); return; }
    const { data: rp } = await supabase
      .from("shop_role_permissions")
      .select("module, action")
      .in("role_id", roleIds);
    const set = new Set<string>();
    (rp ?? []).forEach((p: any) => set.add(`${p.module}:${p.action}`));
    setPermissions(set);
  }, [user]);

  const loadShops = useCallback(async () => {
    if (!user) {
      setShops([]); setCurrentShop(null); setRole(null); setPermissions(new Set()); setLoading(false);
      return;
    }
    setLoading(true);
    const { data: members } = await supabase
      .from("shop_members")
      .select("role, shop_id, shops(*)")
      .eq("user_id", user.id);

    const list: Shop[] = (members ?? [])
      .map((m: any) => m.shops)
      .filter(Boolean);
    setShops(list);

    if (list.length > 0) {
      try { localStorage.removeItem("pos.signupIntent"); } catch {}
    }

    const savedId = localStorage.getItem(STORAGE_KEY);
    const initial = list.find((s) => s.id === savedId) ?? list[0] ?? null;
    setCurrentShop(initial);
    if (initial) {
      const roleEntry = (members ?? []).find((m: any) => m.shop_id === initial.id);
      setRole((roleEntry?.role as ShopRole) ?? null);
      localStorage.setItem(STORAGE_KEY, initial.id);
      await loadPermsFor(initial.id);
    } else {
      setRole(null);
      setPermissions(new Set());
    }
    setLoading(false);
  }, [user, loadPermsFor]);

  useEffect(() => { loadShops(); }, [loadShops]);

  const setCurrentShopId = useCallback(async (id: string) => {
    const shop = shops.find((s) => s.id === id);
    if (!shop || !user) return;
    setCurrentShop(shop);
    localStorage.setItem(STORAGE_KEY, id);
    const { data } = await supabase
      .from("shop_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("shop_id", id)
      .maybeSingle();
    setRole((data?.role as ShopRole) ?? null);
    await loadPermsFor(id);
  }, [shops, user, loadPermsFor]);

  const hasPerm = useCallback((module: string, action: string) => {
    if (role === "owner") return true;
    return permissions.has(`${module}:${action}`);
  }, [role, permissions]);

  return (
    <ShopContext.Provider value={{ shops, currentShop, role, loading, permissions, hasPerm, setCurrentShopId, refresh: loadShops }}>
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used within ShopProvider");
  return ctx;
};
