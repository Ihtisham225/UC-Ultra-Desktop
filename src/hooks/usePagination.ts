import { useEffect, useState } from "react";

const STORAGE_PREFIX = "pos.pageSize.";

/**
 * Client-side pagination state. Persists the chosen page size per "key" in
 * localStorage, and resets the page when the underlying total or any reset
 * dependency changes.
 */
export function usePagination<T>(
  items: T[],
  opts: { key: string; defaultSize?: number; resetDeps?: unknown[] } = { key: "default" },
) {
  const { key, defaultSize = 20, resetDeps = [] } = opts;

  const [pageSize, setPageSizeState] = useState<number>(() => {
    if (typeof window === "undefined") return defaultSize;
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : defaultSize;
  });
  const [page, setPage] = useState(1);

  const setPageSize = (n: number) => {
    setPageSizeState(n);
    setPage(1);
    try { localStorage.setItem(STORAGE_PREFIX + key, String(n)); } catch {}
  };

  // Reset to page 1 whenever the inputs that change the dataset shape change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); }, resetDeps);

  // Clamp page when totals shrink.
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const start = (page - 1) * pageSize;
  const visible = items.slice(start, start + pageSize);

  return {
    page,
    pageSize,
    setPage,
    setPageSize,
    visible,
    totalItems: items.length,
  };
}
