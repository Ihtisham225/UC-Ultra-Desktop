/**
 * syncEngine.ts — Two-way Supabase ↔ IndexedDB sync
 *
 * Pull: fetch rows newer than lastPulledAt, upsert locally (no queue entry)
 * Push: drain sync_queue, upsert/delete on Supabase; latest updated_at wins on conflict
 */

import { supabase as _supabase } from '@/integrations/supabase/client'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any
import {
  SYNC_TABLES,
  type SyncTable,
  getAllQueued,
  removeFromQueue,
  bulkUpsertLocal,
  deleteLocal,
  getLastPulledAt,
  setLastPulledAt,
  notifyChange,
} from './localDb'

// ─── Per-table config ────────────────────────────────────────────────────────

interface TableConfig {
  /** Column used as the sync watermark (ordered ASC, compared with gt) */
  tsColumn: 'updated_at' | 'created_at'
  /** How to filter to only this shop's rows */
  shopFilter: 'shop_id' | 'none'
  /** For tables with no direct shop_id, join through a parent table to filter */
  shopJoin?: { parent: string; parentShopId: string }
}

const TABLE_CONFIG: Record<SyncTable, TableConfig> = {
  products:         { tsColumn: 'updated_at', shopFilter: 'shop_id' },
  product_variants: { tsColumn: 'updated_at', shopFilter: 'shop_id' },
  customers:        { tsColumn: 'updated_at', shopFilter: 'shop_id' },
  suppliers:        { tsColumn: 'updated_at', shopFilter: 'shop_id' },
  debts:            { tsColumn: 'updated_at', shopFilter: 'shop_id' },
  // Tables that use created_at (immutable records) as the watermark
  sales:            { tsColumn: 'created_at', shopFilter: 'shop_id' },
  sale_returns:     { tsColumn: 'created_at', shopFilter: 'shop_id' },
  expenses:         { tsColumn: 'created_at', shopFilter: 'shop_id' },
  purchases:        { tsColumn: 'created_at', shopFilter: 'shop_id' },
  // Tables without direct shop_id — pull via parent join, store synthetic shop_id locally
  sale_items:       { tsColumn: 'created_at', shopFilter: 'none', shopJoin: { parent: 'sales', parentShopId: 'shop_id' } },
  purchase_items:   { tsColumn: 'created_at', shopFilter: 'none', shopJoin: { parent: 'purchases', parentShopId: 'shop_id' } },
}

// ─── Pull ───────────────────────────────────────────────────────────────────

async function pullTable(table: SyncTable, shopId: string) {
  const cfg = TABLE_CONFIG[table]
  const since = await getLastPulledAt(table)
  const pullStart = new Date().toISOString()

  let rows: Record<string, unknown>[] = []

  if (cfg.shopFilter === 'none' && cfg.shopJoin) {
    // Pull via join — e.g. sale_items → sales!inner(shop_id)
    const parentRef = `${cfg.shopJoin.parent}!inner(${cfg.shopJoin.parentShopId})`
    let query = (supabase.from(table) as any)
      .select(`*, ${parentRef}`)
      .eq(`${cfg.shopJoin.parent}.${cfg.shopJoin.parentShopId}`, shopId)
      .order(cfg.tsColumn, { ascending: true })
    if (since) query = query.gt(cfg.tsColumn, since)
    const { data, error } = await query
    if (error) { console.warn(`[sync] pull ${table} error:`, error.message); return }
    // Strip the joined parent object, attach shop_id for local index
    rows = ((data ?? []) as Record<string, unknown>[]).map((r) => {
      const copy = { ...r }
      delete copy[cfg.shopJoin!.parent]
      copy.shop_id = shopId  // synthetic — lets getAll() index work
      return copy
    })
  } else {
    let query = (supabase.from(table) as any)
      .select('*')
      .eq('shop_id', shopId)
      .order(cfg.tsColumn, { ascending: true })
    if (since) query = query.gt(cfg.tsColumn, since)
    const { data, error } = await query
    if (error) { console.warn(`[sync] pull ${table} error:`, error.message); return }
    rows = (data ?? []) as Record<string, unknown>[]
  }

  if (rows.length > 0) {
    await bulkUpsertLocal(table, rows)
    notifyChange(table)
  }

  await setLastPulledAt(table, pullStart)
}

export async function pullAll(shopId: string) {
  for (const table of SYNC_TABLES) {
    try {
      await pullTable(table, shopId)
    } catch (e) {
      console.warn(`[sync] pullTable ${table} threw:`, e)
    }
  }
}

// ─── Push ───────────────────────────────────────────────────────────────────

export async function pushAll() {
  const queue = await getAllQueued()
  if (queue.length === 0) return

  for (const item of queue) {
    try {
      const cfg = TABLE_CONFIG[item.table as SyncTable]
      const tsCol = cfg?.tsColumn ?? 'updated_at'

      if (item.op === 'upsert') {
        // Conflict: if server row has a newer timestamp, keep server
        if (tsCol === 'updated_at') {
          const { data: serverRow } = await (supabase.from(item.table) as any)
            .select('updated_at')
            .eq('id', item.recordId)
            .maybeSingle()

          const serverTs = serverRow?.updated_at ? new Date(serverRow.updated_at).getTime() : 0
          const localTs = item.payload.updated_at
            ? new Date(item.payload.updated_at as string).getTime()
            : Date.now()

          if (serverTs > localTs) {
            // Server is newer — pull that row and discard our queued change
            const { data: freshRow } = await (supabase.from(item.table) as any)
              .select('*')
              .eq('id', item.recordId)
              .maybeSingle()
            if (freshRow) {
              await bulkUpsertLocal(item.table, [freshRow])
              notifyChange(item.table)
            }
            await removeFromQueue(item.qid)
            continue
          }
        }

        // Strip synthetic shop_id for tables that don't have it in Supabase
        const payload = { ...item.payload }
        if (cfg?.shopFilter === 'none') delete payload.shop_id

        const { error } = await (supabase.from(item.table) as any)
          .upsert(payload, { onConflict: 'id' })
        if (error) { console.warn(`[sync] push upsert ${item.table}/${item.recordId}:`, error.message); continue }
      } else if (item.op === 'delete') {
        const { error } = await (supabase.from(item.table) as any)
          .delete()
          .eq('id', item.recordId)
        if (error) { console.warn(`[sync] push delete ${item.table}/${item.recordId}:`, error.message); continue }
      }

      await removeFromQueue(item.qid)
    } catch (e) {
      console.warn(`[sync] push item ${item.qid} threw:`, e)
    }
  }
}

// ─── Full sync ───────────────────────────────────────────────────────────────

let syncing = false

export async function syncAll(shopId: string) {
  if (syncing || !navigator.onLine) return
  syncing = true
  try {
    await pushAll()
    await pullAll(shopId)
  } finally {
    syncing = false
  }
}

// ─── Background sync loop ───────────────────────────────────────────────────

let intervalId: ReturnType<typeof setInterval> | null = null

export function startSyncLoop(getShopId: () => string | null, intervalMs = 30_000) {
  if (intervalId) return

  const run = () => {
    const shopId = getShopId()
    if (shopId) syncAll(shopId).catch(() => {})
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
