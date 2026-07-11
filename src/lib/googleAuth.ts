/**
 * googleAuth.ts — desktop "Sign in with Google".
 *
 * Electron can't do OAuth in-page, so we open ucultra.com/desktop-auth in the
 * system browser; after Google sign-in the web mints a device token and hands
 * it back via the `ucultra://auth` deep link (see electron/main.ts). A `state`
 * nonce ties the callback to the request we started.
 */

import { adoptSession } from "./deviceSession";
import { getDeviceSession } from "./apiClient";

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") || "https://ucultra.com";
const STATE_KEY = "ucu.oauth.state";

/** Open the browser to begin Google sign-in. */
export function startGoogleSignIn() {
  const state =
    (globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + Math.random().toString(36).slice(2));
  try {
    localStorage.setItem(STATE_KEY, state);
  } catch {
    /* ignore */
  }
  const url = `${API_BASE}/desktop-auth?state=${encodeURIComponent(state)}`;
  if (window.electronAPI?.openExternal) window.electronAPI.openExternal(url);
  else window.open(url, "_blank");
}

/**
 * Finish sign-in from a deep-link callback: verify the state nonce, then
 * hydrate and adopt the session from the returned device token.
 */
export async function completeGoogleSignIn(data: {
  token?: string;
  state?: string;
  error?: string;
}): Promise<{ ok: boolean; error?: string }> {
  let expected: string | null = null;
  try {
    expected = localStorage.getItem(STATE_KEY);
  } catch {
    /* ignore */
  }
  if (data.state && expected && data.state !== expected) {
    return { ok: false, error: "Sign-in couldn't be verified. Please try again." };
  }
  try {
    localStorage.removeItem(STATE_KEY);
  } catch {
    /* ignore */
  }

  if (data.error === "no-shop") {
    return { ok: false, error: "This account has no shop yet. Create one at ucultra.com, then sign in." };
  }
  if (!data.token) return { ok: false, error: "Google sign-in was cancelled." };

  try {
    const fresh = await getDeviceSession(data.token);
    adoptSession({ token: data.token, ...fresh }, "google");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sign-in failed" };
  }
}
