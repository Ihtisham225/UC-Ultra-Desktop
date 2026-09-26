/**
 * "The server just changed something" — so the local copy should catch up now.
 *
 * Most screens read the offline store, but many saves go straight to the
 * server through `rpc()` (a purchase, a return, an expense, a cheque…). The
 * server's side effects — the supplier's khata row, the stock, the account —
 * only reached the store on the NEXT background sync, up to half a minute
 * later (longer while a slow sync was in flight). The shop saw the purchase
 * saved and the ledger unchanged, and thought it had failed. The web reads the
 * server directly, so it never had the gap.
 *
 * `rpc()` announces every successful call that is not a plain read; the sync
 * engine listens and pulls straight away.
 */

/**
 * Reads never change anything, so they don't need a sync after them. Anything
 * not matched here counts as a write — an unnecessary sync is cheap, a missed
 * one is the bug this exists to fix.
 */
const READ_ONLY = /^(list|get|load|search|find|compute|export|preview|check|due|sum|parse|audit|recordHistory|vehicleHistory|vehicleDetails|lastVisit|oilChangeFor|global|admin(List|Get|Overview|Pulse|Revenue|ShopHealth|AuditActors|ExportAudit|Renewals))/;

export function isReadOnlyAction(action: string): boolean {
  return READ_ONLY.test(action);
}

type Listener = (action: string) => void;
const listeners = new Set<Listener>();

/** Subscribe to server writes. Returns the unsubscribe function. */
export function onServerWrite(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function announceServerWrite(action: string): void {
  if (isReadOnlyAction(action)) return;
  for (const fn of listeners) {
    try { fn(action); } catch { /* a listener must never break the caller */ }
  }
}
