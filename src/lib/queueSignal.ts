/**
 * "Something was just queued for the server." localDb announces every queued
 * write; the sync engine listens and sends it within a couple of seconds, so a
 * bill or payment made on this till never waits for the (now much slower)
 * background schedule. Its own module so localDb and syncEngine don't import
 * each other.
 */

type Listener = () => void
const listeners = new Set<Listener>()

/** Subscribe to queued writes. Returns the unsubscribe function. */
export function onQueued(fn: Listener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function announceQueued(): void {
  for (const fn of listeners) {
    try { fn() } catch { /* a listener must never break the write */ }
  }
}
