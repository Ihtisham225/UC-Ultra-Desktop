import { useAuth } from "@/contexts/AuthContext";

/**
 * Super-admin flag comes from the cached device session (populated at login by
 * the backend). Reading it from the session means it also works offline — no
 * network round-trip needed.
 */
export function useIsSuperAdmin() {
  const { user } = useAuth();
  return { isSuperAdmin: Boolean(user?.is_super_admin), loading: false };
}
