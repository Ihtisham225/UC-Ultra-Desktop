import { useCallback, useMemo, useState } from "react";

/**
 * Manages a Set of selected row IDs with helpers for toggling individual
 * rows or bulk-selecting/clearing all visible IDs.
 */
export function useRowSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string, on?: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const shouldAdd = on === undefined ? !next.has(id) : on;
      if (shouldAdd) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const setAll = useCallback((ids: string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) ids.forEach((id) => next.add(id));
      else ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const has = useCallback((id: string) => selected.has(id), [selected]);

  const allChecked = useCallback(
    (ids: string[]) => ids.length > 0 && ids.every((id) => selected.has(id)),
    [selected],
  );

  const someChecked = useCallback(
    (ids: string[]) => ids.some((id) => selected.has(id)) && !ids.every((id) => selected.has(id)),
    [selected],
  );

  const ids = useMemo(() => Array.from(selected), [selected]);

  return { selected, ids, count: selected.size, toggle, setAll, clear, has, allChecked, someChecked };
}
