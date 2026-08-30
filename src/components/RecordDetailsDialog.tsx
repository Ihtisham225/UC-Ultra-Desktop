import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface DetailField {
  label: string;
  value: ReactNode;
  /** Span the whole row — for notes and other long text. */
  full?: boolean;
}

export interface DetailTable {
  title?: string;
  columns: { header: ReactNode; align?: "start" | "end" }[];
  rows: ReactNode[][];
  /** Bold row pinned to the bottom, e.g. totals. */
  footer?: ReactNode[];
}

/**
 * Read-only view of one record — a purchase, a challan or a bill. The list
 * rows only have room for a handful of columns, so this is where everything
 * that was entered can actually be read back without opening the edit form
 * and risking a change.
 */
export function RecordDetailsDialog({
  open,
  onClose,
  title,
  subtitle,
  fields,
  tables = [],
  totals = [],
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  fields: DetailField[];
  tables?: DetailTable[];
  /** Highlighted figures under the tables. */
  totals?: { label: string; value: ReactNode; strong?: boolean }[];
  actions?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[96vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </DialogHeader>

        <div className="space-y-4">
          {fields.length > 0 && (
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map((f, i) => (
                <div key={i} className={f.full ? "sm:col-span-2 lg:col-span-3" : undefined}>
                  <div className="text-xs text-muted-foreground">{f.label}</div>
                  <div className="text-sm font-medium mt-0.5 break-words">{f.value || "—"}</div>
                </div>
              ))}
            </div>
          )}

          {tables.map((t, ti) => (
            <div key={ti} className="space-y-1.5">
              {t.title && <div className="text-sm font-medium">{t.title}</div>}
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      {t.columns.map((c, i) => (
                        <th key={i} className={`p-2 font-medium ${c.align === "end" ? "text-end" : "text-start"}`}>
                          {c.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {t.rows.length === 0 ? (
                      <tr>
                        <td colSpan={t.columns.length} className="p-4 text-center text-muted-foreground">
                          Nothing recorded on this one.
                        </td>
                      </tr>
                    ) : (
                      t.rows.map((row, ri) => (
                        <tr key={ri} className="border-t">
                          {row.map((cell, ci) => (
                            <td key={ci} className={`p-2 ${t.columns[ci]?.align === "end" ? "text-end" : ""}`}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                    {t.footer && (
                      <tr className="border-t bg-muted/20 font-semibold">
                        {t.footer.map((cell, ci) => (
                          <td key={ci} className={`p-2 ${t.columns[ci]?.align === "end" ? "text-end" : ""}`}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {totals.length > 0 && (
            <div className="rounded-lg border p-3 space-y-1.5">
              {totals.map((t, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between ${t.strong ? "border-t pt-1.5" : ""}`}
                >
                  <span className="text-sm text-muted-foreground">{t.label}</span>
                  <span className={t.strong ? "text-lg font-bold" : "text-sm font-medium"}>{t.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          {actions}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
