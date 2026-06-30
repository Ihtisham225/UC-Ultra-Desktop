import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { useShop } from "@/contexts/ShopContext";
import { Package } from "lucide-react";

export interface VariantOption {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price_override: number | null;
  stock: number;
}

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
}

/**
 * Dialog that lets the user pick one of a product's variants.
 * Used by both POS (sale) and Purchases (stock-in).
 */
export const VariantPickerDialog = ({
  open,
  onClose,
  productName,
  basePrice,
  variants,
  onPick,
  allowOutOfStock = false,
}: Props) => {
  const { t } = useTranslation();
  const { currentShop } = useShop();
  const formatMoney = useFormatMoney();
  const cur = currentShop?.currency ?? "USD";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-5 text-primary" />
            {t("products.pickVariantTitle")}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {t("products.pickVariantSubtitle", { name: productName })}
          </p>
        </DialogHeader>
        <div className="grid gap-2 max-h-[60vh] overflow-y-auto pe-1">
          {variants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("common.empty")}</p>
          ) : (
            variants.map((v) => {
              const price = v.price_override ?? basePrice;
              const stock = Number(v.stock);
              const disabled = !allowOutOfStock && stock <= 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    onPick(v);
                    onClose();
                  }}
                  disabled={disabled}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 text-start transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-transparent"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{v.name}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {v.sku || "—"}
                      {v.barcode && <span className="ms-2">· {v.barcode}</span>}
                    </div>
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
