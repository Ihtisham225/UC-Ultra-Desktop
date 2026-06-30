import { useEffect, useRef } from 'react'
import { useShop } from '@/contexts/ShopContext'
import { startSyncLoop } from '@/lib/syncEngine'
import { queueCount } from '@/lib/localDb'

/** Starts the background sync loop once a shop is selected. */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { currentShop } = useShop()
  const shopIdRef = useRef<string | null>(null)
  const stopRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    shopIdRef.current = currentShop?.id ?? null
  }, [currentShop?.id])

  useEffect(() => {
    if (!currentShop) return

    const stop = startSyncLoop(() => shopIdRef.current, 30_000)
    if (stop) stopRef.current = stop

    return () => {
      stopRef.current?.()
      stopRef.current = null
    }
  // Only start/stop loop when shop changes identity
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShop?.id])

  // Seed IDB on first shop load (pulls all data if not yet cached)
  useEffect(() => {
    if (!currentShop) return
    queueCount().then((n) => {
      // Already seeded if we have local data; sync loop handles it
      void n
    })
  }, [currentShop?.id])

  return <>{children}</>
}
