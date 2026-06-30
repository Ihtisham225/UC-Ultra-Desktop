import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { consumePendingAuthProvider, getRememberedLogin, saveRememberedLogin } from "@/lib/rememberedAuth";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let hydrated = false;

    const applySession = (s: Session | null) => {
      setSession(s);
      setUser(s?.user ?? null);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      applySession(s);
      if (hydrated) {
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      hydrated = true;
      applySession(s);
      if (s?.user?.email) {
        const pendingProvider = consumePendingAuthProvider();
        const remembered = getRememberedLogin();
        saveRememberedLogin(s.user.email, pendingProvider ?? remembered?.provider ?? "password");
      }
      setLoading(false);
    });

    return () => {
      hydrated = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
