import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <span className="text-sm">Restoring session…</span>
    </div>
  );
  if (!user) return <Navigate to="/auth" state={{ from: loc }} replace />;
  return <>{children}</>;
};
