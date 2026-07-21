import { useCallback, useEffect, useRef, useState } from 'react'
import { getAll, onLocalChange } from '@/lib/localDb'

/**
 * Products joined with their variants from the local store.
 *
 * Synced rows are flat — `products` and `product_variants` are separate
 * localDb tables — so reading products alone (useLocalStore) never yields a
 * `product_variants` array. Every screen that needs variant data (products
 * list/edit, dashboard stock alerts, details) must go through this hook.
 */
export interface LocalVariantRow {
  id: string
  product_id: string
  name: string
  sku: string | null
  barcode: string | null
  price_override: number | null
  stock: number
  low_stock_threshold?: number
  sort_order?: number
  is_active?: boolean
}

type WithVariants<T> = T & { product_variants: LocalVariantRow[] }

export function useProductsWithVariants<T extends { id: string }>(
  shopId: string | null | undefined,
): { data: WithVariants<T>[]; loading: boolean; refresh: () => Promise<void> } {
  const [data, setData] = useState<WithVariants<T>[]>([])
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  const load = useCallback(async () => {
    if (!shopId) { setData([]); setLoading(false); return }
    const [prods, vars] = await Promise.all([
      getAll<T>('products', shopId),
      getAll<Record<string, unknown>>('product_variants', shopId),
    ])
    const byProduct = new Map<string, LocalVariantRow[]>()
    for (const v of vars) {
      const pid = v.product_id as string
      const arr = byProduct.get(pid) ?? []
      arr.push({
        id: v.id as string,
        product_id: pid,
        name: (v.name as string) ?? '',
        sku: (v.sku as string | null) ?? null,
        barcode: (v.barcode as string | null) ?? null,
        price_override:
          v.price_override === null || v.price_override === undefined || v.price_override === ''
            ? null
            : Number(v.price_override),
        stock: Number(v.stock ?? 0),
        low_stock_threshold:
          v.low_stock_threshold === null || v.low_stock_threshold === undefined
            ? undefined
            : Number(v.low_stock_threshold),
        sort_order: v.sort_order === undefined ? undefined : Number(v.sort_order),
        is_active: v.is_active as boolean | undefined,
      })
      byProduct.set(pid, arr)
    }
    for (const arr of byProduct.values()) {
      arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    }
    const joined = prods.map((p) => ({
      ...p,
      product_variants: byProduct.get(p.id) ?? [],
    }))
    if (mounted.current) {
      setData(joined)
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    mounted.current = true
    setLoading(true)
    load()
    return () => { mounted.current = false }
  }, [load])

  useEffect(() => {
    return onLocalChange((table) => {
      if (table === 'products' || table === 'product_variants') load()
    })
  }, [load])

  return { data, loading, refresh: load }
}
