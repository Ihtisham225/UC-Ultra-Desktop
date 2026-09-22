import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  /** Batches shown so far (1 = the first batch). */
  page: number;
  /** Rows per batch. */
  pageSize: number;
  totalItems: number;
  /** Called with `page + 1` when the end of the list comes into view. */
  onPageChange: (page: number) => void;
  /** Kept so existing call sites compile; there is no per-page picker any more. */
  onPageSizeChange?: (size: number) => void;
  /** A server-fetched list is loading its next batch — don't ask again yet. */
  loading?: boolean;
  className?: string;
}

/**
 * The foot of every list: infinite scroll instead of page numbers.
 *
 * An invisible sentinel sits under the last row; when it scrolls into view
 * the next batch is asked for. The observer is rebuilt after every batch, so
 * a short batch that still leaves the sentinel on screen asks again straight
 * away rather than waiting for a scroll that will never come. A "Load more"
 * button stays as a fallback for anything the observer can't see.
 *
 * The name is kept (it replaced the numbered pager in place) so every table
 * switched over without touching its markup.
 */
export function Pagination({ page, pageSize, totalItems, onPageChange, loading, className }: PaginationProps) {
  const { t } = useTranslation();
  const shown = Math.min(page * pageSize, totalItems);
  const more = shown < totalItems;
  const sentinel = useRef<HTMLDivElement | null>(null);
  const ask = useRef(onPageChange);
  useEffect(() => { ask.current = onPageChange; });

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more || loading || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          ask.current(page + 1);
        }
      },
      // Start fetching a little before the end is actually reached.
      { rootMargin: "0px 0px 300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [page, more, loading, totalItems]);

  if (totalItems === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-3 px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground",
        className,
      )}
    >
      <div ref={sentinel} aria-hidden className="h-px w-px" />
      <span className="tabular-nums">
        {t("pagination.showing", { shown, total: totalItems, defaultValue: "Showing {{shown}} of {{total}}" })}
      </span>
      {more && (
        loading ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="size-3.5 animate-spin" /> {t("pagination.loading", { defaultValue: "Loading…" })}
          </span>
        ) : (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onPageChange(page + 1)}>
            {t("pagination.loadMore", { defaultValue: "Load more" })}
          </Button>
        )
      )}
    </div>
  );
}
