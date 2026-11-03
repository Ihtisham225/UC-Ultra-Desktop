import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { getSession, subscribe, switchToShop, refreshShops } from "@/lib/deviceSession";
import { onSynced } from "@/lib/syncEngine";
import type { DeviceShop, ShopRole } from "@/lib/apiClient";
import { setDatePrefs } from "@/lib/date-format";

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
  // Set while rendering, before any child formats a date. A change made on
  // the web arrives with the next shop refresh; screens pick it up as they
  // re-render (Settings here reloads the window instead).
  setDatePrefs(state.currentShop?.date_format, state.currentShop?.time_format);

  useEffect(() => {
    setState(derive());
    return subscribe(() => setState(derive()));
  }, []);

  // Keep shop settings (investors config, currency, receipt…) in step with the
  // web app: re-pull on mount, then ride along with the background sync at most
  // every 10 minutes. ⚠️ No timer of its own — a 60s poll kept the shared Neon
  // database from ever suspending.
  useEffect(() => {
    if (!getSession()) return;
    refreshShops();
    let last = Date.now();
    return onSynced(() => {
      if (Date.now() - last < 10 * 60_000) return;
      last = Date.now();
      void refreshShops();
    });
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
