import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { applyBulkPrice, type BulkPriceMode, type BulkPriceOp } from "@/lib/bulk-price";

/**
 * Change the selected products' prices at once — set them all, or move them up
 * or down by a % or an amount — with a preview before anything is saved.
 *
 * ⚠️ COPIED verbatim to the desktop; each app saves the change its own way.
 */

const MODES: { value: BulkPriceMode; label: string }[] = [
  { value: "percent", label: "By %" },
  { value: "amount", label: "By amount" },
  { value: "set", label: "Set to" },
];

export function BulkPriceDialog({
  open, products, onClose, onApply, formatMoney,
}: {
  open: boolean;
  products: { id: string; name: string; price: number; has_variant_prices?: boolean }[];
  onClose: () => void;
  /** Saves the change; resolves true when it worked (the dialog then closes). */
  onApply: (op: BulkPriceOp) => Promise<boolean>;
  formatMoney: (n: number) => string;
}) {
  const [mode, setMode] = useState<BulkPriceMode>("percent");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [value, setValue] = useState("");
  const [round, setRound] = useState(false);
  const [busy, setBusy] = useState(false);

  // A fresh start each time it opens.
  useEffect(() => {
    if (!open) return;
    setMode("percent"); setDirection(1); setValue(""); setRound(false);
  }, [open]);

  const n = parseFloat(value);
  const valid = Number.isFinite(n) && (mode === "set" ? n >= 0 : n > 0) && !(mode === "percent" && direction === -1 && n >= 100);
  const op: BulkPriceOp = { mode, value: mode === "set" ? n : direction * n, round };
  const preview = products.slice(0, 5);
  const variantNote = mode !== "set" && products.some((p) => p.has_variant_prices);

  const apply = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      if (await onApply(op)) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change price of {products.length} product{products.length === 1 ? "" : "s"}</DialogTitle>
          <DialogDescription>Check the preview, then apply. The change is saved for every selected product.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-1">
            {MODES.map((m) => (
              <Button key={m.value} type="button" size="sm" variant={mode === m.value ? "default" : "outline"} onClick={() => setMode(m.value)} data-enter-skip>
                {m.label}
              </Button>
            ))}
          </div>

          <div className="flex items-end gap-2">
            {mode !== "set" && (
              <div className="grid grid-cols-2 gap-1 shrink-0">
                <Button type="button" size="sm" variant={direction === 1 ? "secondary" : "ghost"} onClick={() => setDirection(1)} data-enter-skip>Increase</Button>
                <Button type="button" size="sm" variant={direction === -1 ? "secondary" : "ghost"} onClick={() => setDirection(-1)} data-enter-skip>Decrease</Button>
              </div>
            )}
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="bulkPriceValue">{mode === "set" ? "New price" : mode === "percent" ? "Percent" : "Amount"}</Label>
              <Input id="bulkPriceValue" type="number" min="0" step="any" inputMode="decimal" autoFocus
                value={value} onChange={(e) => setValue(e.target.value)} placeholder={mode === "percent" ? "10" : "0.00"} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <Checkbox checked={round} onCheckedChange={(v) => setRound(!!v)} />
            Round to a whole number
          </label>

          {valid && (
            <div className="rounded-md border divide-y text-sm">
              {preview.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatMoney(p.price)} → <b className="text-foreground">{formatMoney(applyBulkPrice(p.price, op))}</b>
                  </span>
                </div>
              ))}
              {products.length > preview.length && (
                <div className="px-3 py-1.5 text-xs text-muted-foreground">and {products.length - preview.length} more</div>
              )}
            </div>
          )}
          {variantNote && (
            <p className="text-xs text-muted-foreground">Variants with their own price change by the same {mode === "percent" ? "%" : "amount"}.</p>
          )}
          {mode === "set" && products.some((p) => p.has_variant_prices) && (
            <p className="text-xs text-muted-foreground">Variants with their own price keep it.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void apply()} disabled={busy || !valid}>{busy ? "Saving…" : "Apply"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
