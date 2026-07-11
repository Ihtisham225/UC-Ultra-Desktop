/**
 * apiClient.ts — talks to the new UC Ultra backend (Next.js on ucultra.com),
 * replacing the old @supabase/supabase-js client.
 *
 * Auth: a long-lived device token from POST /api/desktop/login, kept in
 * localStorage and sent as `Authorization: Bearer`. Sync uses /api/sync/pull
 * and /api/sync/push (see the Next app's src/app/api).
 */

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ||
  "https://ucultra.com";

const TOKEN_KEY = "ucu.device.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  if (!navigator.onLine) throw new Error("offline");
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init.headers as Record<string, string>) };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  return body as T;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export type ShopRole = "owner" | "manager" | "cashier";

export interface DeviceShop {
  id: string;
  name: string;
  currency: string;
  tax_rate: number;
  receipt_footer: string | null;
  receipt_header: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  show_tax_line: boolean;
  notify_low_stock: boolean;
  notify_daily_summary: boolean;
  is_pro: boolean;
  pro_until: string | null;
  created_by: string;
  role: ShopRole;
}

export interface DeviceUser {
  id: string;
  email: string;
  display_name: string | null;
  username: string | null;
}

export interface DeviceLoginResult {
  token: string;
  user: DeviceUser;
  currentShopId: string;
  shops: DeviceShop[];
  permissionsByShop: Record<string, string[]>;
}

export async function deviceLogin(identifier: string, password: string, shopId?: string): Promise<DeviceLoginResult> {
  const result = await request<DeviceLoginResult>(
    "/api/desktop/login",
    { method: "POST", body: JSON.stringify({ identifier, password, shopId }) },
    false
  );
  setToken(result.token);
  return result;
}

export interface SwitchShopResult {
  token: string;
  currentShopId: string;
  shops: DeviceShop[];
  permissionsByShop: Record<string, string[]>;
}

export async function switchShop(shopId: string): Promise<SwitchShopResult> {
  const result = await request<SwitchShopResult>(
    "/api/desktop/switch-shop",
    { method: "POST", body: JSON.stringify({ shopId }) },
  );
  setToken(result.token);
  return result;
}

export function logout() {
  setToken(null);
}

// ─── Sync ────────────────────────────────────────────────────────────────────

export interface PullResult {
  changes: Record<string, Record<string, unknown>[]>;
  serverTime: string;
}
export async function syncPull(tables: { table: string; since: string | null }[]): Promise<PullResult> {
  return request<PullResult>("/api/sync/pull", { method: "POST", body: JSON.stringify({ tables }) });
}

export interface PushOp {
  table: string;
  recordId: string;
  op: "upsert" | "delete";
  payload: Record<string, unknown>;
}
export interface PushResult {
  results: { recordId: string; table: string; status: string }[];
  pulled: Record<string, Record<string, unknown>[]>;
  serverTime: string;
}
export async function syncPush(ops: PushOp[]): Promise<PushResult> {
  return request<PushResult>("/api/sync/push", { method: "POST", body: JSON.stringify({ ops }) });
}
