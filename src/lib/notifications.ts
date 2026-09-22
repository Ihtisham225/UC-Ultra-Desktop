/**
 * The header bell's items. Built on the server from the live books (see
 * listNotificationsAction) — nothing is stored, so an item disappears the
 * moment its cause is dealt with. A copy lives in the desktop's
 * `src/lib/notifications.ts` — keep the two in step.
 */
export interface AppNotification {
  /** Stable while the cause stands — "seen" is remembered by this. */
  id: string;
  kind: "low_stock" | "cheque" | "debt_due";
  severity: "info" | "warning" | "critical";
  title: string;
  detail?: string;
  /** The page that deals with it. */
  href: string;
  date?: string;
}

const SEEN_KEY = "ucu.notifications.seen";

/** Ids the viewer has already looked at. Per-browser, a convenience only. */
export function readSeen(shopId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${SEEN_KEY}.${shopId}`);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Remember the current items as seen — only these, so stale ids fall away. */
export function markSeen(shopId: string, ids: string[]) {
  try {
    localStorage.setItem(`${SEEN_KEY}.${shopId}`, JSON.stringify(ids.slice(0, 500)));
  } catch {
    /* private window — the badge just stays */
  }
}
