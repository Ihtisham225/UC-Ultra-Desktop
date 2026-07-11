/**
 * rememberedAccounts.ts — accounts this device has signed into, kept so the
 * login screen can offer one-tap resume (Instagram/Facebook style). Each entry
 * stores the full device session (incl. its long-lived token), so tapping an
 * account signs straight back in without a password; the token is re-validated
 * on tap and, if expired, the app falls back to the password form.
 *
 * This is separate from the ACTIVE session (deviceSession.ts): signing out
 * clears the active session but leaves the remembered account here, so it still
 * shows on the login screen until explicitly forgotten.
 */

import type { StoredSession } from "./deviceSession";
import type { RememberedLoginProvider } from "./rememberedAuth";

export interface RememberedAccount {
  userId: string;
  email: string;
  displayName: string | null;
  provider: RememberedLoginProvider;
  session: StoredSession;
  updatedAt: number;
}

const KEY = "ucu.remembered-accounts";
const MAX = 5;

export function listRememberedAccounts(): RememberedAccount[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as RememberedAccount[];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((a) => a && a.userId && a.email && a.session?.token)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function save(list: RememberedAccount[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

/** Upsert an account (keyed by userId) with its latest session. */
export function rememberAccount(session: StoredSession, provider: RememberedLoginProvider) {
  const entry: RememberedAccount = {
    userId: session.user.id,
    email: session.user.email,
    displayName: session.user.display_name ?? null,
    provider,
    session,
    updatedAt: Date.now(),
  };
  const rest = listRememberedAccounts().filter((a) => a.userId !== entry.userId);
  save([entry, ...rest]);
}

export function getRememberedAccount(userId: string): RememberedAccount | null {
  return listRememberedAccounts().find((a) => a.userId === userId) ?? null;
}

export function forgetAccount(userId: string) {
  save(listRememberedAccounts().filter((a) => a.userId !== userId));
}
