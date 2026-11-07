import * as React from "react";

import { cn } from "@/lib/utils";

/*
 * The app's tables: compact rows (twice as many fit on screen), a quiet
 * uppercase header band, and light stripes so the eye can follow a row across.
 * On a phone each row becomes a labelled card (see `cards` below).
 * Every <Table> in the app picks this up. ⚠️ Identical in the desktop app.
 */

/**
 * Copy each column's header onto its cells as `data-label`, so on a phone the
 * row can be shown as a card that names every value ("Total  PKR 6,990").
 * Kept current with a MutationObserver because rows arrive, page and re-sort
 * after mount; it only watches the row list, never attributes, so setting the
 * labels can't trigger itself.
 */
function useCellLabels(table: React.RefObject<HTMLTableElement | null>, enabled: boolean) {
  React.useEffect(() => {
    const el = table.current;
    if (!el || !enabled) return;
    const apply = () => {
      const heads = el.querySelectorAll<HTMLTableCellElement>(":scope > thead > tr:last-child > th");
      const labels: string[] = [];
      heads.forEach((th) => {
        // Screen-reader-only text isn't a visible heading, and "Actions" in
        // front of a row of buttons says nothing the buttons don't.
        const visible = Array.from(th.childNodes)
          .filter((n) => !(n instanceof HTMLElement && n.classList.contains("sr-only")))
          .map((n) => n.textContent ?? "")
          .join("")
          .trim();
        const text = /^actions?$/i.test(visible) ? "" : visible;
        for (let i = 0; i < (th.colSpan || 1); i++) labels.push(text);
      });
      el.querySelectorAll<HTMLTableRowElement>(":scope > tbody > tr").forEach((tr) => {
        let col = 0;
        Array.from(tr.cells).forEach((td) => {
          // A cell spanning the row (loading / empty / a sub-total) has no single heading.
          const label = td.colSpan > 1 ? "" : labels[col] ?? "";
          if (td.dataset.label !== label) td.dataset.label = label;
          col += td.colSpan || 1;
        });
      });
    };
    apply();
    let queued = false;
    const obs = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => { queued = false; apply(); });
    });
    obs.observe(el, { childList: true, subtree: true, characterData: true });
    return () => obs.disconnect();
  }, [table, enabled]);
}

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & {
    /**
     * On a phone, show each row as a labelled card instead of a wide table
     * (see `.table-cards` in globals.css). On by default; turn it off for a
     * table that is really a form — rows of inputs being typed into.
     */
    cards?: boolean;
  }
>(({ className, cards = true, ...props }, ref) => {
  const inner = React.useRef<HTMLTableElement | null>(null);
  useCellLabels(inner, cards);
  const setRef = (node: HTMLTableElement | null) => {
    inner.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };
  return (
    <div className="relative w-full overflow-auto">
      <table ref={setRef} className={cn("w-full caption-bottom text-sm", cards && "table-cards", className)} {...props} />
    </div>
  );
});
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />,
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn("border-b border-border/60 transition-colors even:bg-muted/25 hover:bg-muted/50 data-[state=selected]:bg-muted", className)}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-10 px-3 text-left align-middle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40 whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("px-3 py-2.5 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
