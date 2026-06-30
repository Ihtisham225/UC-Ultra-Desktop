import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface PaginationProps {
  page: number;            // 1-indexed
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  className?: string;
  pageSizeOptions?: number[];
}

/**
 * Reusable pagination control with page number jumps and a "per page" selector.
 * Hides itself when there's nothing to paginate AND the user hasn't customized
 * the page size away from the default.
 */
export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  className,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: PaginationProps) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const from = totalItems === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, totalItems);

  // Build a compact list of page numbers: first, last, current ± 1, with ellipses.
  const pageNumbers: (number | "ellipsis")[] = [];
  const add = (n: number) => {
    if (!pageNumbers.includes(n) && n >= 1 && n <= totalPages) pageNumbers.push(n);
  };
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) add(i);
  } else {
    add(1);
    if (current > 3) pageNumbers.push("ellipsis");
    for (let i = current - 1; i <= current + 1; i++) add(i);
    if (current < totalPages - 2) pageNumbers.push("ellipsis");
    add(totalPages);
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t bg-muted/20",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {t("pagination.range", { from, to, total: totalItems })}
        </span>
        <span className="hidden sm:inline">·</span>
        <span className="hidden sm:flex items-center gap-1.5">
          {t("pagination.perPage")}
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="h-7 w-[72px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((n) => (
                <SelectItem key={n} value={String(n)} className="text-xs">
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(1)}
          disabled={current <= 1}
          aria-label={t("pagination.first")}
        >
          <ChevronsLeft className="size-4 rtl-flip" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(current - 1)}
          disabled={current <= 1}
          aria-label={t("pagination.prev")}
        >
          <ChevronLeft className="size-4 rtl-flip" />
        </Button>

        <div className="flex items-center gap-0.5">
          {pageNumbers.map((p, i) =>
            p === "ellipsis" ? (
              <span key={`e-${i}`} className="px-1.5 text-xs text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === current ? "default" : "ghost"}
                size="sm"
                className="size-8 px-0 text-xs tabular-nums"
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            ),
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(current + 1)}
          disabled={current >= totalPages}
          aria-label={t("pagination.next")}
        >
          <ChevronRight className="size-4 rtl-flip" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(totalPages)}
          disabled={current >= totalPages}
          aria-label={t("pagination.last")}
        >
          <ChevronsRight className="size-4 rtl-flip" />
        </Button>
      </div>

      {/* Mobile per-page */}
      <div className="sm:hidden w-full flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
        {t("pagination.perPage")}
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="h-7 w-[72px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((n) => (
              <SelectItem key={n} value={String(n)} className="text-xs">
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
