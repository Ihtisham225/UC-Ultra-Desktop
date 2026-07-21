import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { getSession, subscribe, switchToShop, refreshShops } from "@/lib/deviceSession";
import type { DeviceShop, ShopRole } from "@/lib/apiClient";

export type { ShopRole };
export type Shop = DeviceShop;

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

/** Derive the shop view (shops, current, role, permissions) from the cached session. */
function derive() {
  const s = getSession();
  const shops = s?.shops ?? [];
  const currentShop = shops.find((sh) => sh.id === s?.currentShopId) ?? shops[0] ?? null;
  const role = currentShop?.role ?? null;
  const permissions = new Set(currentShop ? s?.permissionsByShop?.[currentShop.id] ?? [] : []);
  return { shops, currentShop, role, permissions };
}

export const ShopProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState(derive);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setState(derive());
    return subscribe(() => setState(derive()));
  }, []);

  // Keep shop settings (investors config, currency, receipt…) in step with the
  // web app: re-pull on mount, when the window regains focus, and every 60s.
  useEffect(() => {
    if (!getSession()) return;
    refreshShops();
    const onFocus = () => refreshShops();
    window.addEventListener("focus", onFocus);
    const id = setInterval(() => { if (document.hasFocus()) refreshShops(); }, 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(id);
    };
  }, []);

  const setCurrentShopId = useCallback(async (id: string) => {
    if (id === state.currentShop?.id) return;
    setLoading(true);
    try {
      await switchToShop(id); // re-scopes the token + refreshes cached session → re-render
    } catch (e) {
      console.warn("[shop] switch failed:", e);
    } finally {
      setLoading(false);
    }
  }, [state.currentShop?.id]);

  const refresh = useCallback(async () => {
    const cur = getSession()?.currentShopId;
    if (cur && navigator.onLine) {
      try { await switchToShop(cur); } catch { /* offline / ignore */ }
    }
  }, []);

  const hasPerm = useCallback(
    (module: string, action: string) => state.role === "owner" || state.permissions.has(`${module}:${action}`),
    [state.role, state.permissions],
  );

  return (
    <ShopContext.Provider
      value={{
        shops: state.shops,
        currentShop: state.currentShop,
        role: state.role,
        loading,
        permissions: state.permissions,
        hasPerm,
        setCurrentShopId,
        refresh,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used within ShopProvider");
  return ctx;
};
