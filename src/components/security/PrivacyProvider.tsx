"use client";

/**
 * Private pages and figures, and what is unlocked right now.
 *
 * A correct authenticator code unlocks ONE thing — the page you're on, or the
 * figure you tapped — and only for as long as you stay on this page. Moving
 * to another page locks everything again, so a screen left open on the
 * counter never stays unlocked.
 *
 * What is private is cached locally per person, so a computer that goes
 * offline doesn't simply show everything (and can't unlock either — codes are
 * checked on the server).
 *
 * ⚠️ COPIED verbatim to the desktop app (`src/components/security/`).
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { normalizePrivacy, type PrivacySettings } from "@/lib/privacy";
import { securityApi } from "@/components/security/security-api";
import { MfaDialog } from "@/components/security/MfaDialog";

interface PrivacyContextValue {
  /** Null until known. */
  mfaEnabled: boolean | null;
  privacy: PrivacySettings;
  isPrivate: (key: string) => boolean;
  /** Private and not unlocked on this page. */
  isLocked: (key: string) => boolean;
  /** Ask for a code; resolves to the unlock token, or null if cancelled. */
  unlock: (key: string, label?: string) => Promise<string | null>;
  /** The token from the last unlock on this page (for server-side figures). */
  token: string | null;
  /** Re-read after Settings → Security changes. */
  refresh: () => Promise<void>;
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

const cacheKey = (userId: string) => `ucu.privacy.${userId}`;

function readCache(userId: string | null | undefined): { mfa: boolean; privacy: PrivacySettings } | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const p = JSON.parse(raw) as { mfa?: boolean; privacy?: unknown };
    return { mfa: !!p.mfa, privacy: normalizePrivacy(p.privacy) };
  } catch {
    return null;
  }
}

export function PrivacyProvider({
  userId,
  pathname,
  children,
}: {
  userId: string | null | undefined;
  /** The current route — leaving it locks everything again. */
  pathname: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<{ mfa: boolean | null; privacy: PrivacySettings }>({ mfa: null, privacy: { items: [] } });
  const [unlocked, setUnlocked] = useState<{ keys: string[]; token: string | null }>({ keys: [], token: null });
  // Any change of page throws every unlock away — including coming BACK to the
  // page that was unlocked, which is why this tracks the change itself rather
  // than remembering which path the unlock was made on. (Adjusting state while
  // rendering is React's pattern for "reset when a prop changes".)
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setUnlocked({ keys: [], token: null });
  }
  const [ask, setAsk] = useState<{ key: string; label?: string } | null>(null);
  const resolver = useRef<((token: string | null) => void) | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const s = await securityApi.status();
      const next = { mfa: s.mfa_enabled, privacy: normalizePrivacy(s.privacy) };
      setState(next);
      try {
        localStorage.setItem(cacheKey(userId), JSON.stringify(next));
      } catch {
        // Storage blocked — the server copy still holds it.
      }
    } catch {
      // Offline: keep the cached choice rather than dropping every lock. With
      // nothing cached this person never made anything private here.
      setState(readCache(userId) ?? { mfa: false, privacy: { items: [] } });
    }
  }, [userId]);

  // Until the answer lands, pages that could be private wait (PrivateGate).
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const here = seenPath === pathname ? unlocked : { keys: [] as string[], token: null };
  const isPrivate = useCallback((key: string) => state.privacy.items.includes(key), [state.privacy.items]);
  const isLocked = (key: string) => isPrivate(key) && !here.keys.includes(key);

  const unlock = (key: string, label?: string) =>
    new Promise<string | null>((resolve) => {
      resolver.current = resolve;
      setAsk({ key, label });
    });

  const finish = (token: string | null) => {
    if (token && ask) {
      setUnlocked({ keys: [...here.keys, ask.key], token });
    }
    setAsk(null);
    resolver.current?.(token);
    resolver.current = null;
  };

  return (
    <PrivacyContext.Provider
      value={{ mfaEnabled: state.mfa, privacy: state.privacy, isPrivate, isLocked, unlock, token: here.token, refresh }}
    >
      {children}
      <MfaDialog open={!!ask} label={ask?.label} onDone={finish} />
    </PrivacyContext.Provider>
  );
}

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext);
  if (ctx) return ctx;
  // Outside the app shell (sign-in, onboarding): nothing is private.
  return {
    mfaEnabled: null,
    privacy: { items: [] },
    isPrivate: () => false,
    isLocked: () => false,
    unlock: async () => null,
    token: null,
    refresh: async () => {},
  };
}
