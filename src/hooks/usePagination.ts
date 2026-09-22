import { useEffect, useState } from "react";

/** How many rows every list reveals at a time as it is scrolled. */
export const SCROLL_BATCH = 20;

/**
 * Client-side infinite scroll. The list shows the first batch, and each time
 * its end scrolls into view (see components/Pagination) the next batch is
 * revealed — no page numbers.
 *
 * `page` counts the batches shown so far, which keeps the shape the tables
 * already used: `<Pagination page onPageChange … />` still works, it just
 * asks for "one more batch" instead of "page N".
 *
 * Resets to the first batch whenever a reset dependency changes (a new
 * search or filter), so a narrowed list starts back at the top.
 */
export function usePagination<T>(
  items: T[],
  opts: { key: string; defaultSize?: number; resetDeps?: unknown[] } = { key: "default" },
) {
  const { resetDeps = [] } = opts;
  const pageSize = SCROLL_BATCH;
  const [page, setPage] = useState(1);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); }, resetDeps);

  // Never ask for more batches than there are rows.
  const batches = Math.max(1, Math.ceil(items.length / pageSize));
  useEffect(() => {
    if (page > batches) setPage(batches);
  }, [page, batches]);

  const visible = items.slice(0, page * pageSize);

  return {
    page,
    pageSize,
    setPage,
    /** Kept for older call sites; the batch size is fixed now. */
    setPageSize: (_n: number) => setPage(1),
    visible,
    totalItems: items.length,
  };
}
