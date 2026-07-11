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
  logout as apiLogout,
  setToken,
  type DeviceUser,
  type DeviceShop,
} from "./apiClient";

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
  return s;
}

/** Re-scope the token to another shop the user belongs to (needs online). */
export async function switchToShop(shopId: string): Promise<void> {
  const current = getSession();
  if (!current) throw new Error("Not signed in");
  const r = await apiSwitchShop(shopId);
  persist({ ...current, token: r.token, currentShopId: r.currentShopId, shops: r.shops, permissionsByShop: r.permissionsByShop });
}

export function signOut() {
  apiLogout();
  persist(null);
}
