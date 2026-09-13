import { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface DetailRow {
  label: string;
  value: ReactNode;
  full?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  rows: DetailRow[];
  footer?: ReactNode;
  /** Shown under the rows and scrolls with them — e.g. a party's history. */
  children?: ReactNode;
  /** Wider for dialogs carrying a table. */
  wide?: boolean;
}

export const DetailsDialog = ({ open, onClose, title, subtitle, rows, footer, children, wide }: Props) => {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${wide ? "sm:max-w-4xl" : "sm:max-w-2xl"} max-h-[90vh] flex flex-col`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </DialogHeader>
        <div className="overflow-y-auto flex-1 -mx-6 px-6 space-y-5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-2">
            {rows.map((r, i) => (
              <div key={i} className={r.full ? "col-span-2" : "col-span-1"}>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{r.label}</div>
                <div className="text-sm font-medium mt-0.5 break-words">{r.value ?? "—"}</div>
              </div>
            ))}
          </div>
          {children}
        </div>
        <DialogFooter>
          {footer}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};