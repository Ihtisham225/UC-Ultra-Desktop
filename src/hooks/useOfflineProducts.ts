import { useCallback, useEffect, useRef, useState } from 'react'
import { getAll, onLocalChange } from '@/lib/localDb'
import { syncAll } from '@/lib/syncEngine'
import type { CachedProduct, CachedVariant } from '@/lib/offlineDb'

// Raw synced rows (snake_case, from /api/sync/pull) as they land in the local store.
interface ProductRow { id: string; name: string; barcode: string | null; price: number | string; stock: number | string; shop_id: string; is_active?: boolean }
interface VariantRow { id: string; product_id: string; name: string; sku: string | null; barcode: string | null; price_override: number | string | null; stock: number | string; is_active?: boolean; sort_order?: number }

/**
 * POS product feed, backed by the two-way sync store (localDb `records`).
 * The sync engine pulls products/product_variants from the backend in the
 * background; this hook just assembles them into the CachedProduct shape POS
 * expects and re-reads whenever the local store changes. Works fully offline.
 */
export function useOfflineProducts(shopId: string | undefined) {
  const [products, setProducts] = useState<CachedProduct[]>([])
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const syncingRef = useRef(false)

  // Track online state
  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const loadFromStore = useCallback(async () => {
    if (!shopId) { setProducts([]); return }
    const [prods, vars] = await Promise.all([
      getAll<ProductRow>('products', shopId),
      getAll<VariantRow>('product_variants', shopId),
    ])
    const variantsByProduct = new Map<string, CachedVariant[]>()
    for (const v of vars) {
      if (v.is_active === false) continue
      const arr = variantsByProduct.get(v.product_id) ?? []
      arr.push({
        id: v.id,
        product_id: v.product_id,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode,
        price_override: v.price_override === null || v.price_override === undefined ? null : Number(v.price_override),
        stock: Number(v.stock),
      })
      variantsByProduct.set(v.product_id, arr)
    }
    const merged: CachedProduct[] = prods
      .filter((p) => p.is_active !== false)
      .map((p) => ({
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        price: Number(p.price),
        stock: Number(p.stock),
        shop_id: shopId,
        variants: variantsByProduct.get(p.id) ?? [],
        _syncedAt: Date.now(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
    setProducts(merged)
  }, [shopId])

  // Force a pull+push, then re-read from the store.
  const refresh = useCallback(async () => {
    if (!shopId || syncingRef.current) return
    syncingRef.current = true
    try {
      if (navigator.onLine) {
        await syncAll()
        setLastSynced(new Date())
      }
      await loadFromStore()
    } finally {
      syncingRef.current = false
    }
  }, [shopId, loadFromStore])

  // Initial: read the store immediately, then sync fresh in the background.
  useEffect(() => {
    if (!shopId) return
    loadFromStore().then(() => { if (navigator.onLine) refresh() })
  }, [shopId, loadFromStore, refresh])

  // Re-read when the sync engine (or another screen) writes products/variants.
  useEffect(() => {
    return onLocalChange((table) => {
      if (table === 'products' || table === 'product_variants') loadFromStore()
    })
  }, [loadFromStore])

  // When coming back online, sync.
  useEffect(() => {
    if (isOnline && shopId) refresh()
  }, [isOnline, shopId, refresh])

  return { products, isOnline, lastSynced, refresh }
}
