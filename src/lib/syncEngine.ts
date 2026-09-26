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
import { onServerWrite } from './serverWrites'
import {
  purgeLocalChildren,
  pruneLocalRows,
  pruneOrphanChildren,
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

  const { changes, serverTime, liveIds, liveShopId } = await syncPull(tables)

  // ⚠️ A corrected bill REPLACES its lines and tenders, so the server's set is
  // the whole truth for that sale. Upserting alone would leave the rows it
  // removed sitting locally — which is how a bill showed its old total beside
  // a tender that had already been deleted. The stale children go first.
  const changedSaleIds = new Set(
    (changes['sales'] ?? []).map((r) => String((r as { id?: unknown }).id ?? '')).filter(Boolean),
  )
  if (changedSaleIds.size > 0) {
    for (const child of ['sale_items', 'sale_payments'] as const) {
      await purgeLocalChildren(child, 'sale_id', changedSaleIds)
    }
  }
  // The same for a purchase or a return edited on the server: its lines were
  // replaced, and the new set arrives in this very pull (they follow the
  // parent's clock). Without this an edited purchase showed its old lines AND
  // its new ones, and the landed cost behind every margin counted both.
  const idsOf = (table: string) =>
    new Set((changes[table] ?? []).map((r) => String((r as { id?: unknown }).id ?? '')).filter(Boolean))
  const changedPurchaseIds = idsOf('purchases')
  const changedReturnIds = idsOf('sale_returns')
  if (changedPurchaseIds.size > 0 && (changes['purchase_items'] ?? []).length > 0) {
    await purgeLocalChildren('purchase_items', 'purchase_id', changedPurchaseIds)
  }
  if (changedReturnIds.size > 0 && (changes['sale_return_items'] ?? []).length > 0) {
    await purgeLocalChildren('sale_return_items', 'return_id', changedReturnIds)
  }

  for (const table of SYNC_TABLES) {
    const rows = changes[table] ?? []
    if (rows.length > 0) {
      await bulkUpsertLocal(table, rows)
      notifyChange(table)
    }
    // Watermark = server time captured before the queries (safe against skew).
    await setLastPulledAt(table, serverTime)
  }
  if (changedSaleIds.size > 0) {
    notifyChange('sale_items')
    notifyChange('sale_payments')
  }

  // ⚠️ Upserting alone never removes a row the server deleted, so a catalogue
  // re-imported under fresh ids left every product on the till twice — and a
  // sale rung up against the stale card moved no stock on the server. The
  // server names every live catalogue id; drop the rest of this shop's.
  //
  // This runs AFTER the upserts, and pushAll has already run before pullAll, so
  // anything created offline has reached the server and is in the live set.
  // Whatever a failed push left in the queue is kept regardless.
  if (liveIds && liveShopId) {
    const queued = await getAllQueued()
    for (const [table, ids] of Object.entries(liveIds)) {
      const keep = new Set(queued.filter((q) => q.table === table).map((q) => q.recordId))
      const removed = await pruneLocalRows(table, liveShopId, new Set(ids), keep)
      if (removed > 0) notifyChange(table)
    }
    // A deleted purchase or return takes its lines with it.
    for (const [parent, child, fk] of [
      ['purchases', 'purchase_items', 'purchase_id'],
      ['sale_returns', 'sale_return_items', 'return_id'],
    ] as const) {
      const live = liveIds[parent]
      if (!live) continue
      const keep = new Set(queued.filter((q) => q.table === parent).map((q) => q.recordId))
      const removed = await pruneOrphanChildren(child, fk, liveShopId, new Set(live), keep)
      if (removed > 0) notifyChange(child)
    }
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

// ─── Sync right after a server write ────────────────────────────────────────

let requested: ReturnType<typeof setTimeout> | null = null

/**
 * Pull as soon as possible after the server changed something. Calls within a
 * moment of each other collapse into one sync (a save that runs three actions
 * back to back pulls once), and it waits for a sync already in flight rather
 * than being skipped by it — the in-flight one may have read the server before
 * this write landed.
 */
export function requestSync(delayMs = 150): void {
  if (requested) return
  requested = setTimeout(() => {
    requested = null
    void syncNow().catch(() => {})
  }, delayMs)
}

// ─── Background sync loop ───────────────────────────────────────────────────

let intervalId: ReturnType<typeof setInterval> | null = null

export function startSyncLoop(getShopId: () => string | null, intervalMs = 30_000) {
  if (intervalId) return

  const run = () => {
    // Only sync when signed in (device token present) with an active shop.
    if (getShopId() && getToken()) syncAll().catch(() => {})
  }

  // ⚠️ The background tick alone left a save made through the server (a
  // purchase, a return, a cheque) invisible in the offline store for up to half
  // a minute — longer behind a slow sync — while the web showed it at once.
  const stopWrites = onServerWrite(() => {
    if (getShopId() && getToken()) requestSync()
  })
  // Coming back to the window: someone may have changed things on the web or
  // on another till in the meantime.
  const onVisible = () => { if (document.visibilityState === 'visible') run() }

  window.addEventListener('online', run)
  window.addEventListener('focus', run)
  document.addEventListener('visibilitychange', onVisible)
  intervalId = setInterval(run, intervalMs)
  run()

  return () => {
    if (intervalId) clearInterval(intervalId)
    intervalId = null
    stopWrites()
    window.removeEventListener('online', run)
    window.removeEventListener('focus', run)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
