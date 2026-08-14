import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, ScanBarcode, Layers, Pill, Stethoscope, FlaskConical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShop } from "@/contexts/ShopContext";
import { CategorySelect } from "@/components/CategorySelect";
import { BrandSelect } from "@/components/BrandSelect";
import { VariantsBuilder, type BuilderVariant } from "@/components/VariantsBuilder";
import { LabParametersBuilder, type LabParameterDraft } from "@/components/LabParametersBuilder";
import { BatchesBuilder } from "@/components/BatchesBuilder";
import { generateSku } from "@/lib/sku";
import { isLabEnabled } from "@/lib/lab";

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
  tracks_imei?: boolean;
  expiry_date?: string | null;
  batch_no?: string | null;
  generic_name?: string | null;
  shelf_location?: string | null;
  is_service?: boolean;
  is_lab_test?: boolean;
  /** Factors this lab test measures (only for service items in a lab-enabled pharmacy). */
  lab_parameters?: LabParameterDraft[];
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
  const isPhone = currentShop?.store_type === "phone";
  // Accessories in a phone shop have no serial, so POS must not ask for one.
  const tracksImei = value.tracks_imei !== false;
  const isPharmacy = currentShop?.store_type === "pharmacy";
  // The Service toggle (and lab test factors) only exist once the shop says it
  // runs a lab — other store types keep services for repair labour etc.
  const labEnabled = isLabEnabled(currentShop);
  const canBeService = !isPharmacy || labEnabled;
  // Services (lab tests, repair labour) hold no stock, so stock-shaped fields
  // and the variants section don't apply to them.
  const isService = !!value.is_service;
  const isLabTest = !!value.is_lab_test;

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

      {/* Services have no stock, so low-stock alert and unit don't apply. */}
      <div className={`grid grid-cols-1 gap-3 ${isService ? "sm:grid-cols-1" : "sm:grid-cols-3"}`}>
        <div className="space-y-1.5">
          <Label>{t("products.sellingPrice")} *</Label>
          <Input
            type="number" step="0.01" min="0"
            value={value.price ?? ""}
            onChange={(e) => set({ price: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
          />
        </div>
        {!isService && (
          <>
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
          </>
        )}
      </div>

      <div className={`grid grid-cols-1 gap-3 ${isService ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <CategorySelect value={value.category_id ?? null} onChange={(id) => set({ category_id: id })} />
        </div>
        {/* A service has no manufacturer. */}
        {!isService && (
          <div className="space-y-1.5">
            <Label>Brand</Label>
            <BrandSelect value={value.brand_id ?? null} onChange={(id) => set({ brand_id: id })} />
          </div>
        )}
      </div>

      {isPhone && !isService && (
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <Label>Has IMEI / serial number</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              On for handsets. Turn off for accessories like cables, adapters and covers —
              POS then stops asking for an IMEI when you sell them.
            </p>
          </div>
          <Switch checked={tracksImei} onCheckedChange={(v) => set({ tracks_imei: v })} />
        </div>
      )}

      {imeiOnProduct && tracksImei && !isService && !value.hasVariants && (
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

      {isPharmacy && !isService && (
        <div className="rounded-lg border bg-card p-3 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Pill className="size-4 text-primary" /> Pharmacy details
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Generic / salt name</Label>
              <Input
                value={value.generic_name ?? ""}
                onChange={(e) => set({ generic_name: e.target.value })}
                placeholder="e.g. Paracetamol"
              />
              <p className="text-xs text-muted-foreground">Also searched at POS, so staff can find it by salt.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Shelf / rack</Label>
              <Input
                value={value.shelf_location ?? ""}
                onChange={(e) => set({ shelf_location: e.target.value })}
                placeholder="e.g. Rack B-4"
              />
              <p className="text-xs text-muted-foreground">Shown at POS so staff can find the box fast.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Expiry date</Label>
              <Input
                type="date"
                value={value.expiry_date ?? ""}
                onChange={(e) => set({ expiry_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Batch no.</Label>
              <Input
                value={value.batch_no ?? ""}
                onChange={(e) => set({ batch_no: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            These apply when you don&apos;t track batches. Selling two batches at once? Add them below.
          </p>
        </div>
      )}

      {canBeService && (
      <div className="rounded-lg border bg-card p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor="isService" className="cursor-pointer flex items-center gap-2">
              <Stethoscope className="size-4 text-primary" />
              Service (no stock)
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              For lab tests, repair labour and other charges — sells at POS but never tracks stock.
            </p>
          </div>
          <Switch
            id="isService"
            checked={isService}
            onCheckedChange={(checked) =>
              set(checked
                ? { is_service: true, hasVariants: false, variants: [] }
                : { is_service: false, is_lab_test: false })
            }
          />
        </div>
      </div>
      )}

      {/* Being a lab test is an explicit choice, not something inferred from
          the factor list — a test is a test before its factors are typed in. */}
      {isService && isPharmacy && labEnabled && (
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="isLabTest" className="cursor-pointer flex items-center gap-2">
                <FlaskConical className="size-4 text-primary" />
                Lab test
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Sells on the POS <b>Lab Tests</b> tab and raises a token in the Lab queue.
              </p>
            </div>
            <Switch
              id="isLabTest"
              checked={isLabTest}
              onCheckedChange={(checked) => set({ is_lab_test: checked })}
            />
          </div>
        </div>
      )}

      {isLabTest && isPharmacy && labEnabled && (
        <LabParametersBuilder
          value={value.lab_parameters ?? []}
          onChange={(lab_parameters) => set({ lab_parameters })}
        />
      )}

      {/* Pharmacies: batches, not attribute-based variants. */}
      {!hideVariants && !isService && isPharmacy && (
        <BatchesBuilder
          value={(value.variants ?? []) as BuilderVariant[]}
          basePrice={Number(value.price) || 0}
          onChange={(variants) => set({ variants, hasVariants: variants.length > 0 })}
        />
      )}

      {!hideVariants && !isService && !isPharmacy && (
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
          {isPharmacy && !value.hasVariants && (
            <p className="text-xs text-muted-foreground">
              Turn on when the same medicine is bought at different rates — each batch keeps its own
              price, expiry and stock (e.g. Panadol batch A at 2, batch B at 4).
            </p>
          )}
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
