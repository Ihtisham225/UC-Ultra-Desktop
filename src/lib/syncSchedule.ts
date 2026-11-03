/**
 * When the background sync runs next. Pure, so the rule can be pinned by a test.
 *
 * ⚠️ Every pull is a query against the one Neon database all shops share, and
 * Neon only suspends (and stops billing) after 5 minutes with NO queries from
 * anyone. A till syncing every 30s around the clock — often left on overnight —
 * kept it awake permanently. So the till syncs often only while someone is
 * actually using it, slows down when nobody has touched it for a while, and
 * stops completely when it is idle, minimised, locked or asleep. It catches up
 * the moment someone comes back. A till's OWN changes are still sent within
 * seconds of being made (see requestSync), whatever the schedule says.
 */

/** Sync interval while someone is using the till. */
export const ACTIVE_MS = 60_000
/** No input for this long and the till is "quiet"… */
export const QUIET_AFTER_MS = 5 * 60_000
/** …and syncs this often. */
export const QUIET_MS = 15 * 60_000
/** No input for this long and it stops syncing until someone comes back. */
export const IDLE_AFTER_MS = 30 * 60_000

export interface SyncScheduleInput {
  now: number
  /** Last keypress / click / focus in the app. */
  lastActivity: number
  /** The window is minimised or hidden to the tray. */
  hidden: boolean
  /** The computer is locked or asleep (reported by the main process). */
  away: boolean
  activeMs?: number
}

/** Milliseconds until the next background sync, or null to pause. */
export function nextSyncDelay({ now, lastActivity, hidden, away, activeMs = ACTIVE_MS }: SyncScheduleInput): number | null {
  if (hidden || away) return null
  const quietFor = now - lastActivity
  if (quietFor >= IDLE_AFTER_MS) return null
  if (quietFor >= QUIET_AFTER_MS) return QUIET_MS
  return activeMs
}
