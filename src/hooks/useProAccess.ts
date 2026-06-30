import { useShop } from "@/contexts/ShopContext";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";

export function useProAccess() {
  const { currentShop } = useShop();
  const { isSuperAdmin } = useIsSuperAdmin();
  if (isSuperAdmin) {
    return { isPro: true, proUntil: null as Date | null, daysLeft: Infinity };
  }
  const proUntil = currentShop?.pro_until ? new Date(currentShop.pro_until) : null;
  const active = !!currentShop?.is_pro && (!proUntil || proUntil > new Date());
  const daysLeft = proUntil ? Math.max(0, Math.ceil((proUntil.getTime() - Date.now()) / 86_400_000)) : 0;
  return { isPro: active, proUntil, daysLeft };
}
