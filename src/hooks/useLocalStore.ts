/**
 * useLocalStore — React hook for IndexedDB-first data access.
 *
 * Reads come exclusively from local IDB.
 * Writes go to IDB first and are queued for background sync to Supabase.
 * Components never call Supabase directly.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import {
  getAll,
  getById,
  upsertLocal,
  deleteLocal,
  onLocalChange,
  notifyChange,
} from '@/lib/localDb'

export interface LocalStoreResult<T> {
  data: T[]
  loading: boolean
  refresh: () => Promise<void>
  /** Write a record to IDB and queue for remote sync */
  save: (record: Partial<T> & { id?: string }) => Promise<T>
  /** Delete a record from IDB and queue for remote sync */
  remove: (id: string) => Promise<void>
}

export function useLocalStore<T extends { id: string }>(
  table: string,
  shopId: string | null | undefined,
): LocalStoreResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  const load = useCallback(async () => {
    if (!shopId) { setData([]); setLoading(false); return }
    const rows = await getAll<T>(table, shopId)
    if (mounted.current) {
      setData(rows)
      setLoading(false)
    }
  }, [table, shopId])

  // Initial load
  useEffect(() => {
    mounted.current = true
    setLoading(true)
    load()
    return () => { mounted.current = false }
  }, [load])

  // Reload when another tab/component writes to the same table
  useEffect(() => {
    return onLocalChange((changedTable) => {
      if (changedTable === table) load()
    })
  }, [table, load])

  const save = useCallback(async (partial: Partial<T> & { id?: string }): Promise<T> => {
    const now = new Date().toISOString()
    const record = {
      ...partial,
      id: partial.id ?? uuid(),
      shop_id: shopId,
      updated_at: now,
      created_at: partial.id ? (partial as any).created_at ?? now : now,
    } as unknown as T
    await upsertLocal(table, record as unknown as Record<string, unknown>, true)
    notifyChange(table)
    return record
  }, [table, shopId])

  const remove = useCallback(async (id: string) => {
    await deleteLocal(table, id, true)
    notifyChange(table)
  }, [table])

  return { data, loading, refresh: load, save, remove }
}

// ─── Single-record variant ─────────────────────────────────────────────────

export function useLocalRecord<T>(table: string, id: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) { setData(null); setLoading(false); return }
    const row = await getById<T>(table, id)
    setData(row)
    setLoading(false)
  }, [table, id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    return onLocalChange((changedTable) => {
      if (changedTable === table) load()
    })
  }, [table, load])

  return { data, loading, refresh: load }
}
