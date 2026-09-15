import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { NEW_PARAM, registerAddNew } from "@/lib/add-new";

/**
 * Let the Ctrl/Cmd+E popup open this page's "new" forms.
 *
 *   useAddNew({ product: () => setEditing({ ...blank }) });
 *
 * Pass only what the current user may create — a handler that is registered
 * is a promise that pressing Enter on it opens a form. Handlers may change
 * every render; the latest one is always called.
 *
 * Arriving with `?new=<id>` (the popup navigated here) runs the handler once
 * and strips the param, so coming back to the page doesn't reopen the form.
 *
 * ⚠️ The param is cleared through the router, not history.replaceState: the
 * app runs on a HashRouter, and a bare replaceState drops the hash and throws
 * the window back to the app root (same rule as useDaybookHandoff).
 *
 * The web app's `src/hooks/useAddNew.ts` does the same with Next's URL handling.
 */
export function useAddNew(entries: Record<string, (() => void) | false | null | undefined>) {
  const latest = useRef(entries);
  useEffect(() => { latest.current = entries; });
  const [params, setParams] = useSearchParams();
  const wanted = params.get(NEW_PARAM);

  const ids = Object.entries(entries).filter(([, h]) => !!h).map(([id]) => id);
  const key = ids.join("|");

  useEffect(() => {
    if (!key) return;
    const wrapped: Record<string, () => void> = {};
    for (const id of key.split("|")) {
      wrapped[id] = () => {
        const h = latest.current[id];
        if (h) h();
      };
    }
    return registerAddNew(wrapped);
  }, [key]);

  useEffect(() => {
    if (!key || !wanted || !key.split("|").includes(wanted)) return;
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.delete(NEW_PARAM);
      return next;
    }, { replace: true });
    const h = latest.current[wanted];
    if (h) h();
  }, [key, wanted, setParams]);
}
