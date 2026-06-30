import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { cacheProducts, getCachedProducts, type CachedProduct } from '@/lib/offlineDb'

export function useOfflineProducts(shopId: string | undefined) {
  const [products, setProducts] = useState<CachedProduct[]>([])
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const syncRef = useRef(false)

  // Track online state
  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const loadFromCache = useCallback(async () => {
    if (!shopId) return
    const cached = await getCachedProducts(shopId)
    if (cached.length > 0) setProducts(cached)
  }, [shopId])

  const syncFromServer = useCallback(async () => {
    if (!shopId || syncRef.current) return
    syncRef.current = true
    try {
      const [{ data: prods }, { data: vars }] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, barcode, price, stock')
          .eq('shop_id', shopId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('product_variants')
          .select('id, product_id, name, sku, barcode, price_override, stock')
          .eq('shop_id', shopId)
          .eq('is_active', true)
          .order('sort_order'),
      ])
      if (!prods) return

      const variantsByProduct = new Map<string, CachedProduct['variants']>()
      ;(vars ?? []).forEach((v: any) => {
        const arr = variantsByProduct.get(v.product_id) ?? []
        arr.push(v)
        variantsByProduct.set(v.product_id, arr)
      })

      const merged: CachedProduct[] = prods.map((p: any) => ({
        ...p,
        shop_id: shopId,
        variants: variantsByProduct.get(p.id) ?? [],
        _syncedAt: Date.now(),
      }))

      await cacheProducts(shopId, merged)
      setProducts(merged)
      setLastSynced(new Date())
    } finally {
      syncRef.current = false
    }
  }, [shopId])

  // On mount: load cache immediately, then sync from server in background
  useEffect(() => {
    if (!shopId) return
    loadFromCache().then(() => {
      if (navigator.onLine) syncFromServer()
    })
  }, [shopId, loadFromCache, syncFromServer])

  // When coming back online, sync
  useEffect(() => {
    if (isOnline && shopId) syncFromServer()
  }, [isOnline, shopId, syncFromServer])

  return { products, isOnline, lastSynced, refresh: syncFromServer }
}
