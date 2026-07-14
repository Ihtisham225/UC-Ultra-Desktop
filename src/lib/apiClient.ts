/**
 * apiClient.ts — talks to the new UC Ultra backend (Next.js on ucultra.com),
 * replacing the old @supabase/supabase-js client.
 *
 * Auth: a long-lived device token from POST /api/desktop/login, kept in
 * localStorage and sent as `Authorization: Bearer`. Sync uses /api/sync/pull
 * and /api/sync/push (see the Next app's src/app/api).
 */

export const API_BASE =
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
  is_super_admin?: boolean;
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

export interface DeviceSessionResult {
  user: DeviceUser;
  currentShopId: string;
  shops: DeviceShop[];
  permissionsByShop: Record<string, string[]>;
}

/**
 * Re-hydrate the session for the given device token (defaults to the stored
 * one). Validates the token server-side and returns fresh user/shops. Throws
 * "HTTP 401" when the token is expired/invalid so callers can prompt for a
 * password instead. Online-only.
 */
export async function getDeviceSession(token?: string): Promise<DeviceSessionResult> {
  const init: RequestInit = {};
  if (token) init.headers = { Authorization: `Bearer ${token}` };
  return request<DeviceSessionResult>("/api/desktop/session", init, !token);
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

// ─── Password reset (unauthenticated) ─────────────────────────────────────────

/** Request a password-reset email. Always resolves (server never reveals if the email exists). */
export async function requestPasswordReset(email: string): Promise<void> {
  await request("/api/desktop/forgot-password", { method: "POST", body: JSON.stringify({ email }) }, false);
}

/** Complete a password reset using the email + token from the reset link. */
export async function resetPasswordWithToken(input: {
  email: string;
  token: string;
  password: string;
}): Promise<{ ok: boolean; error?: string }> {
  return request<{ ok: boolean; error?: string }>(
    "/api/desktop/reset-password",
    { method: "POST", body: JSON.stringify(input) },
    false,
  );
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

// ─── RPC ─────────────────────────────────────────────────────────────────────

/**
 * Invoke a server action on the Next backend by name via /api/desktop/rpc.
 * The dispatcher runs the real web server action, shop-scoped by our device
 * token, so the desktop's online-only screens (staff, settings, reports,
 * analytics, admin, catalog…) reuse the exact web logic instead of talking to
 * Supabase directly. Throws the action's error message on failure.
 *
 * These calls are ONLINE-ONLY — they hit the network every time (unlike the
 * offline-first POS domain, which goes through the sync engine). `request()`
 * already throws "offline" when navigator.onLine is false.
 */
export async function rpc<T = unknown>(action: string, ...args: unknown[]): Promise<T> {
  const { result } = await request<{ result: T }>("/api/desktop/rpc", {
    method: "POST",
    body: JSON.stringify({ action, args }),
  });
  return result;
}

/**
 * Upload a shop logo. Multipart (a File can't go through the JSON RPC
 * dispatcher), so it hits a dedicated token-authed endpoint. Returns the new
 * public URL. Online-only.
 */
export async function uploadShopLogo(file: File): Promise<string> {
  if (!navigator.onLine) throw new Error("offline");
  const form = new FormData();
  form.append("file", file);
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/desktop/upload-logo`, { method: "POST", headers, body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !(body as { url?: string }).url) throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  return (body as { url: string }).url;
}

/** Upload a site-branding asset (og | logo | favicon) — super-admin only; URL is saved server-side. */
export async function uploadSiteAsset(kind: "og" | "logo" | "favicon", file: File): Promise<string> {
  if (!navigator.onLine) throw new Error("offline");
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", file);
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/desktop/upload-site-asset`, { method: "POST", headers, body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !(body as { url?: string }).url) throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  return (body as { url: string }).url;
}

/** Upload a purchase-invoice image, returning its public URL (stored on the purchase when saved). */
export async function uploadInvoiceImage(file: File): Promise<string> {
  if (!navigator.onLine) throw new Error("offline");
  const form = new FormData();
  form.append("file", file);
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/desktop/upload-invoice`, { method: "POST", headers, body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !(body as { url?: string }).url) throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  return (body as { url: string }).url;
}
