import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useShop } from "@/contexts/ShopContext";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";

export const RequireSubscription = ({ children }: { children: ReactNode }) => {
  const { currentShop, loading } = useShop();
  const { isSuperAdmin, loading: adminLoading } = useIsSuperAdmin();
  if (loading || adminLoading) return null;
  if (isSuperAdmin) return <>{children}</>;
  const proUntil = currentShop?.pro_until ? new Date(currentShop.pro_until) : null;
  const active = !!currentShop?.is_pro && (!proUntil || proUntil > new Date());
  if (!active) return <Navigate to="/plan-required" replace />;
  return <>{children}</>;
};
