import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";

export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { isSuperAdmin, loading } = useIsSuperAdmin();
  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!isSuperAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
