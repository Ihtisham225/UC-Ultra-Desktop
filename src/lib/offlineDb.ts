import { openDB, type IDBPDatabase } from 'idb'

export interface CachedProduct {
  id: string
  name: string
  barcode: string | null
  price: number
  stock: number
  shop_id: string
  variants: CachedVariant[]
  _syncedAt: number
}

export interface CachedVariant {
  id: string
  product_id: string
  name: string
  sku: string | null
  barcode: string | null
  price_override: number | null
  stock: number
}

export interface PendingSale {
  localId: string
  shopId: string
  payload: unknown
  createdAt: number
}

let _db: IDBPDatabase | null = null

async function getDb() {
  if (_db) return _db
  _db = await openDB('uc-ultra-offline', 1, {
    upgrade(db) {
      db.createObjectStore('products', { keyPath: 'id' })
      const sales = db.createObjectStore('pending_sales', { keyPath: 'localId' })
      sales.createIndex('shopId', 'shopId')
    },
  })
  return _db
}

// ─── Products ──────────────────────────────────────────────────────────────

export async function cacheProducts(shopId: string, products: CachedProduct[]) {
  const db = await getDb()
  const tx = db.transaction('products', 'readwrite')
  for (const p of products) {
    await tx.store.put({ ...p, shop_id: shopId, _syncedAt: Date.now() })
  }
  await tx.done
}

export async function getCachedProducts(shopId: string): Promise<CachedProduct[]> {
  const db = await getDb()
  const all = await db.getAll('products')
  return all.filter((p) => p.shop_id === shopId)
}

// ─── Pending sales (offline queue) ─────────────────────────────────────────

export async function enqueueSale(shopId: string, payload: unknown): Promise<string> {
  const db = await getDb()
  const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`
  await db.put('pending_sales', { localId, shopId, payload, createdAt: Date.now() })
  return localId
}

export async function getPendingSales(shopId: string): Promise<PendingSale[]> {
  const db = await getDb()
  return db.getAllFromIndex('pending_sales', 'shopId', shopId)
}

export async function removePendingSale(localId: string) {
  const db = await getDb()
  await db.delete('pending_sales', localId)
}

export async function pendingSaleCount(shopId: string): Promise<number> {
  return (await getPendingSales(shopId)).length
}
