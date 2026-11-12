import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * One-time landing params (global search's `?purchase=<id>`, `?q=`…): hand
 * them to `onLand` once, then clear them so going back doesn't reopen it.
 *
 * ⚠️ Through the router, never `history.replaceState` — the app runs on a
 * HashRouter, and writing a bare path drops the hash and throws the counter
 * back to the root.
 */
export function useLandingParams<K extends string>(
  names: readonly K[],
  onLand: (values: Partial<Record<K, string>>) => void,
  /** Hold off until the page can act on it (its data loaded, say). */
  ready = true,
) {
  const [params, setParams] = useSearchParams();
  const latest = useRef(onLand);
  useEffect(() => { latest.current = onLand; });
  useEffect(() => {
    if (!ready) return;
    const out: Partial<Record<K, string>> = {};
    for (const n of names) {
      const v = params.get(n);
      if (v) out[n] = v;
    }
    if (Object.keys(out).length === 0) return;
    setParams((p) => { for (const n of names) p.delete(n); return p; }, { replace: true });
    latest.current(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, ready]);
}
