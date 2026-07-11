import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { getSession, subscribe, signIn as sessionSignIn, signOut as sessionSignOut } from "@/lib/deviceSession";
import type { DeviceUser } from "@/lib/apiClient";
import { saveRememberedLogin } from "@/lib/rememberedAuth";

interface AuthContextValue {
  user: DeviceUser | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<DeviceUser | null>(() => getSession()?.user ?? null);
  const [loading, setLoading] = useState(false);

  // Restore the cached session on mount (works fully offline) and stay in sync.
  useEffect(() => {
    setUser(getSession()?.user ?? null);
    return subscribe(() => setUser(getSession()?.user ?? null));
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    setLoading(true);
    try {
      const s = await sessionSignIn(identifier, password);
      if (s.user.email) saveRememberedLogin(s.user.email, "password");
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    sessionSignOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
