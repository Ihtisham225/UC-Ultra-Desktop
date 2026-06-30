import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useShop } from "@/contexts/ShopContext";

export const RequireShop = ({ children }: { children: ReactNode }) => {
  const { shops, loading, currentShop } = useShop();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading shop…</div>;
  if (shops.length === 0 || !currentShop) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
};
