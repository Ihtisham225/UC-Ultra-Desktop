/**
 * localDb.ts — IndexedDB as the single source of truth.
 *
 * Schema
 * ──────
 * records      { _table, id, ...row }   — all entity data, keyed by [_table, id]
 * sync_state   { table, lastPulledAt }  — watermark per table
 * sync_queue   { qid, table, recordId, op, payload, queuedAt } — outbound ops
 */

import { openDB, type IDBPDatabase } from 'idb'

export type SyncOp = 'upsert' | 'delete'

export interface QueueItem {
  qid: string
  table: string
  recordId: string
  op: SyncOp
  payload: Record<string, unknown>
  queuedAt: number
}

export interface SyncState {
  table: string
  lastPulledAt: string | null  // ISO timestamp
}

// Tables the sync engine manages
export const SYNC_TABLES = [
  'products',
  'product_variants',
  'sales',
  'sale_items',
  'customers',
  'expenses',
  'purchases',
  'purchase_items',
  'suppliers',
  'debts',
  'sale_returns',
] as const

export type SyncTable = typeof SYNC_TABLES[number]

let _db: IDBPDatabase | null = null

export async function getLocalDb() {
  if (_db) return _db
  _db = await openDB('uc-ultra-local', 1, {
    upgrade(db) {
      // Generic entity store: composite key [_table, id]
      const records = db.createObjectStore('records', { keyPath: ['_table', 'id'] })
      records.createIndex('byTable', '_table')
      records.createIndex('byTableShop', ['_table', 'shop_id'])

      db.createObjectStore('sync_state', { keyPath: 'table' })

      const queue = db.createObjectStore('sync_queue', { keyPath: 'qid' })
      queue.createIndex('byTable', 'table')
    },
  })
  return _db
}

// ─── Records ───────────────────────────────────────────────────────────────

export async function getAll<T>(table: string, shopId: string): Promise<T[]> {
  const db = await getLocalDb()
  const all = await db.getAllFromIndex('records', 'byTableShop', [table, shopId])
  return all as T[]
}

export async function getById<T>(table: string, id: string): Promise<T | null> {
  const db = await getLocalDb()
  const rec = await db.get('records', [table, id])
  return (rec as T) ?? null
}

/** Upsert a record locally. Pass enqueue=true to add to outbound sync queue. */
export async function upsertLocal(
  table: string,
  record: Record<string, unknown>,
  enqueue: boolean,
) {
  const db = await getLocalDb()
  const entry = { ...record, _table: table }
  await db.put('records', entry)
  if (enqueue) {
    await enqueueOp(table, record.id as string, 'upsert', record)
  }
}

/** Bulk-upsert from server (no queue — these are already on the server). */
export async function bulkUpsertLocal(table: string, records: Record<string, unknown>[]) {
  const db = await getLocalDb()
  const tx = db.transaction('records', 'readwrite')
  for (const r of records) {
    await tx.store.put({ ...r, _table: table })
  }
  await tx.done
}

export async function deleteLocal(table: string, id: string, enqueue: boolean) {
  const db = await getLocalDb()
  await db.delete('records', [table, id])
  if (enqueue) {
    await enqueueOp(table, id, 'delete', { id })
  }
}

// ─── Sync state ────────────────────────────────────────────────────────────

export async function getLastPulledAt(table: string): Promise<string | null> {
  const db = await getLocalDb()
  const state: SyncState | undefined = await db.get('sync_state', table)
  return state?.lastPulledAt ?? null
}

export async function setLastPulledAt(table: string, ts: string) {
  const db = await getLocalDb()
  await db.put('sync_state', { table, lastPulledAt: ts })
}

// ─── Sync queue ────────────────────────────────────────────────────────────

async function enqueueOp(
  table: string,
  recordId: string,
  op: SyncOp,
  payload: Record<string, unknown>,
) {
  const db = await getLocalDb()
  // Replace any existing queued op for the same record (last write wins locally)
  const existing = await db.getAllFromIndex('sync_queue', 'byTable', table)
  const prev = existing.find((q) => q.recordId === recordId)
  if (prev) await db.delete('sync_queue', prev.qid)

  const qid = `${table}:${recordId}:${Date.now()}`
  await db.put('sync_queue', { qid, table, recordId, op, payload, queuedAt: Date.now() })
}

export async function getAllQueued(): Promise<QueueItem[]> {
  const db = await getLocalDb()
  return db.getAll('sync_queue')
}

export async function removeFromQueue(qid: string) {
  const db = await getLocalDb()
  await db.delete('sync_queue', qid)
}

export async function queueCount(): Promise<number> {
  const db = await getLocalDb()
  return db.count('sync_queue')
}

// ─── Change notification (simple broadcast) ────────────────────────────────

const channel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('uc-ultra-local-changes')
  : null

export function notifyChange(table: string) {
  channel?.postMessage({ table })
}

export function onLocalChange(cb: (table: string) => void): () => void {
  if (!channel) return () => {}
  const handler = (e: MessageEvent) => cb(e.data.table)
  channel.addEventListener('message', handler)
  return () => channel.removeEventListener('message', handler)
}
