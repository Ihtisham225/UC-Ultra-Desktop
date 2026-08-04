import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, ScanBarcode, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShop } from "@/contexts/ShopContext";
import { CategorySelect } from "@/components/CategorySelect";
import { BrandSelect } from "@/components/BrandSelect";
import { VariantsBuilder, type BuilderVariant } from "@/components/VariantsBuilder";
import { generateSku } from "@/lib/sku";

/**
 * Shape the shared fields read/write. Deliberately loose so both the Products
 * page (full ProductDto) and the purchase form (a blank draft) can use it.
 */
export interface ProductFormValue {
  name?: string;
  sku?: string | null;
  barcode?: string | null;
  price?: number;
  low_stock_threshold?: number;
  unit?: string | null;
  category_id?: string | null;
  brand_id?: string | null;
  imei1?: string | null;
  imei2?: string | null;
  hasVariants?: boolean;
  variants?: BuilderVariant[];
}

interface Props<T extends ProductFormValue> {
  value: T;
  onChange: (next: T) => void;
  /** Opens the camera scanner to fill the barcode field. Hidden when omitted. */
  onScanBarcode?: () => void;
  /** Hide the variants section (not currently used, kept for callers that need it). */
  hideVariants?: boolean;
}

/**
 * The product fields shared by the Products page and the "New product" dialog
 * inside the purchase form — one definition so the two can't drift apart.
 */
export function ProductFormFields<T extends ProductFormValue>({
  value,
  onChange,
  onScanBarcode,
  hideVariants = false,
}: Props<T>) {
  const { t } = useTranslation();
  const { currentShop } = useShop();
  // Phone shops that record the handset serial on the product (not at sale).
  const imeiOnProduct =
    currentShop?.store_type === "phone" && currentShop?.imei_capture_mode === "product";

  const set = (patch: Partial<ProductFormValue>) => onChange({ ...value, ...patch } as T);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t("common.name")} *</Label>
          <Input
            autoFocus
            value={value.name ?? ""}
            onChange={(e) => set({ name: e.target.value })}
            onBlur={() => {
              if (!value.sku && value.name) set({ sku: generateSku(value.name) });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("products.skuAuto")}</Label>
          <div className="flex gap-2">
            <Input
              value={value.sku ?? ""}
              placeholder={t("products.skuPlaceholder")}
              onChange={(e) => set({ sku: e.target.value })}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              title={t("products.regenerateSku")}
              onClick={() => set({ sku: generateSku(value.name || "") })}
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t("products.barcode")}</Label>
        <div className="flex gap-2">
          <Input
            value={value.barcode ?? ""}
            placeholder="Scan or type the product's barcode (optional)"
            inputMode="numeric"
            onChange={(e) => set({ barcode: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
          />
          {onScanBarcode && (
            <Button type="button" variant="outline" size="icon" title="Scan barcode" onClick={onScanBarcode}>
              <ScanBarcode className="size-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Leave blank to auto-generate. For mart items, scan the barcode printed on the package so it can be scanned at checkout.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>{t("products.sellingPrice")} *</Label>
          <Input
            type="number" step="0.01" min="0"
            value={value.price ?? ""}
            onChange={(e) => set({ price: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("products.lowAt")}</Label>
          <Input
            type="number" step="0.01"
            value={value.low_stock_threshold ?? ""}
            onChange={(e) => set({ low_stock_threshold: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("products.unit")}</Label>
          <Input value={value.unit ?? "pcs"} onChange={(e) => set({ unit: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <CategorySelect value={value.category_id ?? null} onChange={(id) => set({ category_id: id })} />
        </div>
        <div className="space-y-1.5">
          <Label>Brand</Label>
          <BrandSelect value={value.brand_id ?? null} onChange={(id) => set({ brand_id: id })} />
        </div>
      </div>

      {imeiOnProduct && !value.hasVariants && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>IMEI 1</Label>
            <Input
              value={value.imei1 ?? ""}
              onChange={(e) => set({ imei1: e.target.value })}
              placeholder="Primary IMEI"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label>IMEI 2 <span className="text-muted-foreground font-normal">(dual SIM)</span></Label>
            <Input
              value={value.imei2 ?? ""}
              onChange={(e) => set({ imei2: e.target.value })}
              placeholder="Optional"
              inputMode="numeric"
            />
          </div>
        </div>
      )}

      {!hideVariants && (
        <div className="rounded-lg border bg-card p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="hasVariants" className="cursor-pointer flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              {t("products.hasVariants")}
            </Label>
            <Switch
              id="hasVariants"
              checked={!!value.hasVariants}
              onCheckedChange={(checked) =>
                set({ hasVariants: checked, variants: checked ? (value.variants ?? []) : [] })
              }
            />
          </div>
          {value.hasVariants && (
            <VariantsBuilder
              productName={value.name ?? ""}
              basePrice={Number(value.price) || 0}
              value={(value.variants ?? []) as BuilderVariant[]}
              onChange={(variants) => set({ variants })}
            />
          )}
        </div>
      )}
    </div>
  );
}
