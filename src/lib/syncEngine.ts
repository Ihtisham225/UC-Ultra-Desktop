/**
 * syncEngine.ts — Two-way sync between IndexedDB and the UC Ultra backend
 * (Next.js on ucultra.com), via apiClient.
 *
 * Pull: batch-fetch rows newer than each table's watermark, upsert locally.
 * Push: drain sync_queue in one request; the server resolves conflicts
 *       (last-write-wins) and runs stock/inventory logic for sale/purchase
 *       items, returning any server-newer rows to apply locally.
 */

import { syncPush, syncPull, getToken, type PushOp } from './apiClient'
import {
  SYNC_TABLES,
  getAllQueued,
  removeFromQueue,
  bulkUpsertLocal,
  getLastPulledAt,
  setLastPulledAt,
  notifyChange,
} from './localDb'

// ─── Pull ───────────────────────────────────────────────────────────────────

export async function pullAll() {
  // Gather each table's watermark and fetch all changes in one request.
  const tables = await Promise.all(
    SYNC_TABLES.map(async (table) => ({ table, since: await getLastPulledAt(table) })),
  )

  const { changes, serverTime } = await syncPull(tables)

  for (const table of SYNC_TABLES) {
    const rows = changes[table] ?? []
    if (rows.length > 0) {
      await bulkUpsertLocal(table, rows)
      notifyChange(table)
    }
    // Watermark = server time captured before the queries (safe against skew).
    await setLastPulledAt(table, serverTime)
  }
}

// ─── Push ───────────────────────────────────────────────────────────────────

export async function pushAll() {
  const queue = await getAllQueued()
  if (queue.length === 0) return

  const ops: PushOp[] = queue.map((q) => ({
    table: q.table,
    recordId: q.recordId,
    op: q.op,
    payload: q.payload,
  }))

  const { results, pulled } = await syncPush(ops)

  // Remove every op the server accepted; keep only genuine failures for retry.
  const qidByKey = new Map(queue.map((q) => [`${q.table}:${q.recordId}`, q.qid]))
  for (const r of results) {
    const failed = r.status.startsWith('error') || r.status === 'parent-missing'
    if (failed) continue
    const qid = qidByKey.get(`${r.table}:${r.recordId}`)
    if (qid) await removeFromQueue(qid)
  }

  // Apply any server-newer rows the push returned (LWW conflicts).
  for (const table of Object.keys(pulled)) {
    const rows = pulled[table] ?? []
    if (rows.length > 0) {
      await bulkUpsertLocal(table, rows)
      notifyChange(table)
    }
  }
}

// ─── Full sync ───────────────────────────────────────────────────────────────

/** The sync currently in flight, so callers can wait on it instead of racing. */
let current: Promise<void> | null = null

function startSync(): Promise<void> {
  const run = (async () => {
    try {
      await pushAll()
      await pullAll()
    } catch (e) {
      console.warn('[sync] syncAll failed:', e)
    }
  })()
  current = run
  void run.finally(() => { if (current === run) current = null })
  return run
}

/**
 * Best-effort sync. Skips outright when one is already running — right for the
 * background loop, which only cares that a sync happens soon.
 */
export async function syncAll(): Promise<void> {
  if (current || !navigator.onLine || !getToken()) return
  return startSync()
}

/**
 * Wait for whatever is in flight, then run a sync guaranteed to include
 * everything queued up to this moment.
 *
 * Anything whose next step depends on the server having its rows must use this
 * and not syncAll(). syncAll() returns instantly while the 30s background loop
 * is mid-sync, so the caller would carry on against rows that had never been
 * pushed — which is how a till asking for its server-issued order number got
 * told the sale did not exist, and kept the provisional code on the slip.
 * Waiting on the in-flight run alone is not enough either: it may have
 * snapshotted the queue before these rows were written.
 */
export async function syncNow(): Promise<void> {
  if (!navigator.onLine || !getToken()) return
  if (current) await current.catch(() => {})
  return startSync()
}

// ─── Background sync loop ───────────────────────────────────────────────────

let intervalId: ReturnType<typeof setInterval> | null = null

export function startSyncLoop(getShopId: () => string | null, intervalMs = 30_000) {
  if (intervalId) return

  const run = () => {
    // Only sync when signed in (device token present) with an active shop.
    if (getShopId() && getToken()) syncAll().catch(() => {})
  }

  window.addEventListener('online', run)
  intervalId = setInterval(run, intervalMs)
  run()

  return () => {
    if (intervalId) clearInterval(intervalId)
    intervalId = null
    window.removeEventListener('online', run)
  }
}
