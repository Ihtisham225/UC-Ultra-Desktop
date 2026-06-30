import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useShop } from "@/contexts/ShopContext";
import type { ShopRole } from "@/contexts/ShopContext";

export const RequireRole = ({ roles, children }: { roles: ShopRole[]; children: ReactNode }) => {
  const { role, loading } = useShop();
  if (loading) return null;
  if (!role || !roles.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
};
