/**
 * When the owner clears a store (Settings → Danger → Clear all data) the server
 * stamps `shops.data_reset_at`, and every pull carries it. A terminal whose own
 * copy of that stamp differs is holding data from before the clear, and must
 * wipe this shop's offline store and pull again from nothing — otherwise it
 * goes on selling the products and showing the bills that were just cleared.
 */

const key = (shopId: string) => `ucu.dataResetAt.${shopId}`

export function storedResetAt(shopId: string): string | null {
  try { return localStorage.getItem(key(shopId)) } catch { return null }
}

export function rememberResetAt(shopId: string, at: string) {
  try { localStorage.setItem(key(shopId), at) } catch { /* private window: re-checked next pull */ }
}

/**
 * Whether this pull must wipe the shop's local rows first.
 * - No reset on the server (null, or an older server that doesn't send it): never.
 * - A terminal pulling from nothing (every watermark empty) has nothing stale —
 *   it only needs to remember the stamp, not wipe and pull twice.
 * - Otherwise: whenever the stamp differs from the one this terminal last saw,
 *   including never having seen one (it was offline, or on an older build,
 *   when the store was cleared).
 */
export function mustWipe(server: string | null | undefined, stored: string | null, freshPull: boolean): boolean {
  if (!server) return false
  if (freshPull) return false
  return server !== stored
}
