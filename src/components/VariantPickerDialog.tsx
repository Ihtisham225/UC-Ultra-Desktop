import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { useShop } from "@/contexts/ShopContext";
import { Check, Package, Plus, Search } from "lucide-react";

export interface VariantOption {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price_override: number | null;
  stock: number;
  imei1?: string | null;
  imei2?: string | null;
  expiry_date?: string | null;
  batch_no?: string | null;
}

/** Last 5 digits of an IMEI, e.g. "…87847". */
const imeiTail = (s?: string | null) => (s && s.length > 5 ? `…${s.slice(-5)}` : (s || ""));

interface Props {
  open: boolean;
  onClose: () => void;
  productName: string;
  basePrice: number;
  variants: VariantOption[];
  /** Called with the chosen variant. The dialog closes itself. */
  onPick: (variant: VariantOption) => void;
  /** When true, out-of-stock variants are still selectable (e.g. Purchases). */
  allowOutOfStock?: boolean;
  /** Shows a "+ New batch" row (Purchases) so a new batch can be stocked inline. */
  onAddBatch?: () => void;
  /**
   * Purchases stock several variants of the same product at once, so the rows
   * become tick boxes and one button adds them all. POS sells a single unit at
   * a time and leaves this off.
   */
  multiSelect?: boolean;
  /** Called with every ticked variant when `multiSelect` is on. */
  onPickMany?: (variants: VariantOption[]) => void;
}

/**
 * Dialog that lets the user pick one of a product's variants.
 * Used by both POS (sale) and Purchases (stock-in).
 */
/** Days until expiry; null when undated. Negative means already expired. */
const daysLeft = (d?: string | null): number | null => {
  if (!d) return null;
  return Math.floor((new Date(d + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
};

export const VariantPickerDialog = ({
  open,
  onClose,
  productName,
  basePrice,
  variants,
  onPick,
  allowOutOfStock = false,
  onAddBatch,
  multiSelect = false,
  onPickMany,
}: Props) => {
  const { t } = useTranslation();
  const { currentShop } = useShop();
  const formatMoney = useFormatMoney();
  const cur = currentShop?.currency ?? "USD";
  // Pharmacy batches read as "batch", not the generic "variant".
  const isBatches = variants.some((v) => !!v.batch_no);

  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // A stale query from the previous product would silently hide everything.
  useEffect(() => { if (open) { setQuery(""); setPicked(new Set()); } }, [open, productName]);

  // Short lists are faster to read than to filter; the box would just be noise.
  const showSearch = variants.length > 5;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...variants].sort((a, b) => {
      const da = daysLeft(a.expiry_date), db = daysLeft(b.expiry_date);
      if (da === null && db === null) return 0;
      if (da === null) return 1;   // undated batches go last
      if (db === null) return -1;
      return da - db;
    });
    if (!q) return sorted;
    // Everything printed on the row is searchable, so scanning a barcode or
    // typing the last digits of an IMEI lands straight on the right one.
    return sorted.filter((v) =>
      [v.name, v.batch_no, v.sku, v.barcode, v.imei1, v.imei2, v.expiry_date]
        .some((f) => f && String(f).toLowerCase().includes(q)),
    );
  }, [variants, query]);

  const pick = (v: VariantOption, disabled: boolean) => {
    if (disabled) return;
    if (multiSelect) {
      setPicked((prev) => {
        const next = new Set(prev);
        if (next.has(v.id)) next.delete(v.id); else next.add(v.id);
        return next;
      });
      return;
    }
    onPick(v);
    onClose();
  };

  const addPicked = () => {
    const chosen = variants.filter((v) => picked.has(v.id));
    if (chosen.length === 0) return;
    onPickMany?.(chosen);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg md:max-w-2xl lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-5 text-primary" />
            {isBatches ? "Select batch" : t("products.pickVariantTitle")}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {isBatches
              ? `${productName} — soonest expiry first`
              : t("products.pickVariantSubtitle", { name: productName })}
          </p>
        </DialogHeader>
        {showSearch && (
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // One match left: Enter takes it, so a scan needs no click.
                if (e.key !== "Enter" || shown.length !== 1) return;
                const only = shown[0];
                pick(only, !allowOutOfStock && Number(only.stock) <= 0);
              }}
              placeholder={isBatches ? "Search batch, expiry…" : "Search name, SKU, barcode, IMEI…"}
              className="ps-9"
            />
          </div>
        )}
        <div className="grid gap-2 max-h-[60vh] overflow-y-auto pe-1">
          {variants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("common.empty")}</p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nothing matches “{query}”.
            </p>
          ) : (
            shown.map((v) => {
              const price = v.price_override ?? basePrice;
              const stock = Number(v.stock);
              const disabled = !allowOutOfStock && stock <= 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => pick(v, disabled)}
                  disabled={disabled}
                  className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-start transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-transparent ${picked.has(v.id) ? "border-primary bg-primary/5" : ""}`}
                >
                  {multiSelect && (
                    <span
                      aria-hidden
                      className={`flex size-5 shrink-0 items-center justify-center rounded border ${picked.has(v.id) ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"}`}
                    >
                      {picked.has(v.id) && <Check className="size-3.5" />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">
                      {v.batch_no ? `Batch ${v.batch_no}` : v.name}
                    </div>
                    {v.expiry_date ? (
                      (() => {
                        const d = daysLeft(v.expiry_date);
                        const bad = d !== null && d < 0;
                        const soon = d !== null && d >= 0 && d <= 30;
                        return (
                          <div className={`text-xs truncate ${bad ? "text-destructive font-medium" : soon ? "text-amber-600" : "text-muted-foreground"}`}>
                            {bad ? "EXPIRED" : "Expires"} {v.expiry_date}
                            {!bad && d !== null && <span className="ms-1">({d}d)</span>}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {v.sku || "—"}
                        {v.barcode && <span className="ms-2">· {v.barcode}</span>}
                      </div>
                    )}
                    {(v.imei1 || v.imei2) && (
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {[v.imei1, v.imei2].filter(Boolean).map((x) => `IMEI ${imeiTail(x)}`).join("  ")}
                      </div>
                    )}
                  </div>
                  <div className="text-end shrink-0">
                    <div className="font-semibold tabular-nums">{formatMoney(price, cur)}</div>
                    <div className={`text-xs tabular-nums ${stock <= 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {stock <= 0 ? t("products.outOfStock") : `${t("common.stock")}: ${stock}`}
                    </div>
                  </div>
                </button>
              );
            })
          )}
          {onAddBatch && (
            <button
              type="button"
              onClick={onAddBatch}
              className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary/5"
            >
              <Plus className="size-4" /> New batch
            </button>
          )}
        </div>
        {multiSelect && (
          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <span className="text-sm text-muted-foreground">
              {picked.size === 0 ? "Tick the variants you bought" : `${picked.size} selected`}
            </span>
            <Button onClick={addPicked} disabled={picked.size === 0}>
              Add {picked.size > 0 ? picked.size : ""} to purchase
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};