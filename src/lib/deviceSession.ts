/**
 * deviceSession.ts — the desktop's persisted sign-in state.
 *
 * The full login result (user, full shop records, per-shop permissions) is
 * cached in localStorage so the terminal restores its session — and keeps
 * working — completely offline after the first online login. AuthContext and
 * ShopContext both read from here and subscribe to changes.
 */

import {
  deviceLogin,
  switchShop as apiSwitchShop,
  getDeviceSession,
  logout as apiLogout,
  setToken,
  type DeviceUser,
  type DeviceShop,
} from "./apiClient";
import { rememberAccount, getRememberedAccount, forgetAccount } from "./rememberedAccounts";
import type { RememberedLoginProvider } from "./rememberedAuth";

export interface StoredSession {
  token: string;
  user: DeviceUser;
  currentShopId: string;
  shops: DeviceShop[];
  permissionsByShop: Record<string, string[]>;
}

const KEY = "ucu.device.session";
const listeners = new Set<() => void>();

export function getSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function persist(s: StoredSession | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  // Keep the bare token (used by apiClient auth headers) in sync too.
  setToken(s?.token ?? null);
  listeners.forEach((l) => l());
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function signIn(identifier: string, password: string): Promise<StoredSession> {
  const r = await deviceLogin(identifier, password);
  const s: StoredSession = {
    token: r.token,
    user: r.user,
    currentShopId: r.currentShopId,
    shops: r.shops,
    permissionsByShop: r.permissionsByShop,
  };
  persist(s);
  rememberAccount(s, "password");
  return s;
}

/** Persist a session obtained out-of-band (e.g. the Google OAuth bridge). */
export function adoptSession(s: StoredSession, provider: RememberedLoginProvider = "password") {
  persist(s);
  rememberAccount(s, provider);
}

/**
 * One-tap resume of a remembered account. Re-validates its saved token online
 * (refreshing user/shops); if offline, resumes optimistically from the cached
 * session. Returns "expired" when the token is no longer valid so the caller
 * can fall back to the password form.
 */
export async function resumeAccount(
  userId: string,
): Promise<{ ok: boolean; reason?: "expired" | "gone"; email?: string }> {
  const acc = getRememberedAccount(userId);
  if (!acc) return { ok: false, reason: "gone" };

  if (!navigator.onLine) {
    // Offline: trust the cached session (the app works fully offline).
    persist(acc.session);
    return { ok: true };
  }

  try {
    const fresh = await getDeviceSession(acc.session.token);
    const s: StoredSession = { token: acc.session.token, ...fresh };
    persist(s);
    rememberAccount(s, acc.provider);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("401") || /unauthor/i.test(msg)) {
      // Token expired/revoked — keep the account listed but require a password.
      return { ok: false, reason: "expired", email: acc.email };
    }
    // Other/transient error — fall back to the cached session so the terminal
    // still opens (offline-first).
    persist(acc.session);
    return { ok: true };
  }
}

export { forgetAccount };

/** Re-scope the token to another shop the user belongs to (needs online). */
export async function switchToShop(shopId: string): Promise<void> {
  const current = getSession();
  if (!current) throw new Error("Not signed in");
  const r = await apiSwitchShop(shopId);
  persist({ ...current, token: r.token, currentShopId: r.currentShopId, shops: r.shops, permissionsByShop: r.permissionsByShop });
}

/**
 * Re-pull fresh shop records (settings like investors_enabled, mode, currency…)
 * and permissions for the current token, without re-scoping. Lets web-side
 * shop-setting changes reach the desktop between logins. Online-only, silent
 * on failure (offline-first). Only persists when something actually changed,
 * so it won't churn the session on every poll.
 */
export async function refreshShops(): Promise<void> {
  const current = getSession();
  if (!current || !navigator.onLine) return;
  try {
    const fresh = await getDeviceSession(current.token);
    const next: StoredSession = {
      token: current.token,
      user: fresh.user,
      currentShopId: fresh.currentShopId,
      shops: fresh.shops,
      permissionsByShop: fresh.permissionsByShop,
    };
    if (JSON.stringify({ ...current, token: "" }) !== JSON.stringify({ ...next, token: "" })) {
      persist(next);
    }
  } catch {
    /* offline / transient — keep the cached session */
  }
}

export function signOut() {
  apiLogout();
  persist(null);
}
