import { useState, useEffect, useRef, useCallback } from 'react'
import { getCacheEntry, setCacheEntry } from '@/lib/offlineDb'

interface OfflineQueryResult<T> {
  data: T | null
  loading: boolean
  isOnline: boolean
  fromCache: boolean
  refresh: () => void
}

/**
 * Cache-first data fetcher for any page.
 *
 * - Loads from IndexedDB instantly (no spinner for cached data)
 * - If online: fetches fresh data in background, updates cache + state
 * - If offline: returns cache immediately, never touches the network
 *
 * @param cacheKey  Unique string key per query (include shopId to avoid cross-shop leakage)
 * @param fetcher   Async function that calls Supabase and returns data
 * @param deps      Re-run fetcher when these change (like useEffect deps)
 */
export function useOfflineQuery<T>(
  cacheKey: string | null,
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): OfflineQueryResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [fromCache, setFromCache] = useState(false)
  const fetchingRef = useRef(false)

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const run = useCallback(async () => {
    if (!cacheKey || fetchingRef.current) return
    fetchingRef.current = true

    // 1. Load from cache immediately — zero wait
    const cached = await getCacheEntry<T>(cacheKey)
    if (cached !== null) {
      setData(cached)
      setFromCache(true)
      setLoading(false)
    }

    // 2. If offline, stop here — don't hang on network
    if (!navigator.onLine) {
      if (cached === null) setLoading(false)
      fetchingRef.current = false
      return
    }

    // 3. Fetch fresh in background (don't show spinner if we have cache)
    try {
      const fresh = await fetcher()
      await setCacheEntry(cacheKey, fresh)
      setData(fresh)
      setFromCache(false)
    } catch {
      // Network error — cache already shown, silently ignore
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, ...deps])

  useEffect(() => {
    setLoading(true)
    setFromCache(false)
    run()
  }, [run])

  // Re-sync when coming back online
  useEffect(() => {
    if (isOnline && cacheKey) run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  return { data, loading, isOnline, fromCache, refresh: run }
}
