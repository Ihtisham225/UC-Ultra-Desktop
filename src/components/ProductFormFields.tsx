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
import { SaleUnitsBuilder, type SaleUnitDraft } from "@/components/SaleUnitsBuilder";
import { generateSku } from "@/lib/sku";
import { isLabEnabled } from "@/lib/lab";
import { isOil, OIL_UNIT_SUGGESTIONS } from "@/lib/oil";
import { LocationSelect } from "@/components/LocationSelect";
import type { LocationRow } from "@/lib/storage-locations";
import { DateInput } from "@/components/DateInput";
import { formatMoney } from "@/lib/format";
import { costBaseFor, markupFromPrice, priceFromMarkup, type PurchaseCosts } from "@/lib/purchase-costs";

/**
 * Shape the shared fields read/write. Deliberately loose so both the Products
 * page (full ProductDto) and the purchase form (a blank draft) can use it.
 */
export interface ProductFormValue {
  name?: string;
  sku?: string | null;
  barcode?: string | null;
  price?: number;
  /** Price-by-markup shops: the % on the current cost. */
  markup_percent?: number | null;
  /**
   * Price-by-markup shops: the Current cost box. undefined = untouched (it
   * shows the saved cost, see costBaseFor); null = cleared by hand.
   */
  current_cost?: number | null;
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
  /** Where it's kept (lib/storage-locations). */
  location_id?: string | null;
  is_service?: boolean;
  is_lab_test?: boolean;
  /** Factors this lab test measures (only for service items in a lab-enabled pharmacy). */
  lab_parameters?: LabParameterDraft[];
  /** Alternate units this product can be sold in (oil shops). */
  sale_units?: SaleUnitDraft[];
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
  /**
   * The shop's shelves and racks. When given, the form offers a shelf for the
   * product (and each variant); omitted, the field isn't shown.
   */
  locations?: LocationRow[];
  /**
   * The product's last two purchase prices (lib/purchase-costs). Shown, with a
   * markup % that sets the selling price, when the shop prices by markup.
   * Undefined for a product never bought, or while they load.
   */
  purchaseCosts?: PurchaseCosts | null;
  /** The current cost saved on the product (products.current_cost), if any. */
  savedCost?: number | null;
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
  locations,
  purchaseCosts,
  savedCost,
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
  // Oil is stocked in litres and sold by the bottle or the drum, so the unit
  // is a choice at the till rather than a fixed label on the product.
  const isOilShop = isOil(currentShop);
  // The Service toggle (and lab test factors) only exist once the shop says it
  // runs a lab — other store types keep services for repair labour etc.
  const labEnabled = isLabEnabled(currentShop);
  const canBeService = !isPharmacy || labEnabled;
  // Services (lab tests, repair labour) hold no stock, so stock-shaped fields
  // and the variants section don't apply to them.
  const isService = !!value.is_service;
  const isLabTest = !!value.is_lab_test;

  const set = (patch: Partial<ProductFormValue>) => onChange({ ...value, ...patch } as T);

  // Settings → Shop → "Price by markup %": selling price = current cost +
  // the markup. Services are never bought.
  const byMarkup = !!currentShop?.price_by_markup && !isService;
  const cur = currentShop?.currency ?? "PKR";
  // What it cost last time: the cost saved on the product, else the latest purchase.
  const previousCost = costBaseFor(undefined, savedCost, purchaseCosts);
  const costBase = costBaseFor(value.current_cost, savedCost, purchaseCosts);
  const latestDiffers =
    purchaseCosts?.latest != null && costBase != null && Math.abs(purchaseCosts.latest - costBase) >= 0.01;

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
            // A scanner ends every code with Enter. The dialog's Enter chain
            // (lib/form-keys) turns that into "next box", so a scan lands the
            // cursor on the price rather than being swallowed here.
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

      {byMarkup && (
        <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
          <div className="text-sm">
            <div className="text-xs text-muted-foreground">Previously purchased at</div>
            <div className="font-semibold tabular-nums">{previousCost != null ? formatMoney(previousCost, cur) : "—"}</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Current cost</Label>
              <Input
                type="number" step="0.01" min="0"
                value={costBase ?? ""}
                placeholder="What it costs you now"
                onChange={(e) => {
                  const c = e.target.value === "" ? null : parseFloat(e.target.value);
                  const cost = c != null && Number.isFinite(c) ? c : null;
                  const m = value.markup_percent == null ? null : Number(value.markup_percent);
                  set({
                    current_cost: cost,
                    // The markup stays put and the price follows it; with no
                    // markup yet, the price stays and the % is worked out.
                    ...(cost != null && m != null && Number.isFinite(m)
                      ? { price: priceFromMarkup(cost, m) }
                      : cost != null && value.price != null
                        ? { markup_percent: markupFromPrice(cost, Number(value.price)) }
                        : {}),
                  });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Markup %</Label>
              <Input
                type="number" step="0.01"
                value={value.markup_percent ?? ""}
                placeholder="e.g. 20"
                onChange={(e) => {
                  const m = e.target.value === "" ? null : parseFloat(e.target.value);
                  set({
                    markup_percent: m,
                    // The price follows the % whenever there is a cost to add it to.
                    ...(m != null && Number.isFinite(m) && costBase != null ? { price: priceFromMarkup(costBase, m) } : {}),
                  });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("products.sellingPrice")} *</Label>
              <Input
                type="number" step="0.01" min="0"
                value={value.price ?? ""}
                onChange={(e) => {
                  const p = e.target.value === "" ? undefined : parseFloat(e.target.value);
                  // A price typed by hand works the % back out, so the two agree.
                  set({ price: p, ...(p != null && costBase != null ? { markup_percent: markupFromPrice(costBase, p) } : {}) });
                }}
              />
            </div>
          </div>
          {latestDiffers ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                Last bought at {formatMoney(purchaseCosts!.latest!, cur)} (expenses included).
              </span>
              <Button
                type="button" size="sm" variant="outline" className="h-7"
                onClick={() => {
                  const cost = purchaseCosts!.latest!;
                  const m = value.markup_percent == null ? null : Number(value.markup_percent);
                  set({ current_cost: cost, ...(m != null && Number.isFinite(m) ? { price: priceFromMarkup(cost, m) } : {}) });
                }}
              >
                Use {formatMoney(purchaseCosts!.latest!, cur)}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Selling price = current cost + markup %. The current cost is saved with the product and shown as the previous price next time.
            </p>
          )}
        </div>
      )}

      {/* Services have no stock, so low-stock alert and unit don't apply. */}
      <div className={`grid grid-cols-1 gap-3 ${isService ? "sm:grid-cols-1" : byMarkup ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        {!byMarkup && (
          <div className="space-y-1.5">
            <Label>{t("products.sellingPrice")} *</Label>
            <Input
              type="number" step="0.01" min="0"
              value={value.price ?? ""}
              onChange={(e) => set({ price: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
            />
          </div>
        )}
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
              <Input
                value={value.unit ?? "pcs"}
                list={isOilShop ? "unit-suggestions" : undefined}
                onChange={(e) => set({ unit: e.target.value })}
              />
              {isOilShop && (
                <datalist id="unit-suggestions">
                  {OIL_UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}
                </datalist>
              )}
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

      {/* Where it's kept. A service sits on no shelf. */}
      {locations && !isService && (
        <div className="space-y-1.5">
          <Label>Shelf / rack</Label>
          <LocationSelect
            value={value.location_id ?? null}
            onChange={(id) => set({ location_id: id })}
            locations={locations}
          />
          <p className="text-xs text-muted-foreground">
            Shown at POS so staff can fetch it fast.
            {!value.location_id && value.shelf_location?.trim() && (
              <> Old label: <span className="font-medium">{value.shelf_location}</span> — turn old labels into shelves on the Shelves page.</>
            )}
          </p>
        </div>
      )}

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
            {/* The typed shelf label lived here before shelves were real places.
                With the Shelves page it's only offered where no places exist. */}
            {!locations && (
              <div className="space-y-1.5">
                <Label>Shelf / rack</Label>
                <Input
                  value={value.shelf_location ?? ""}
                  onChange={(e) => set({ shelf_location: e.target.value })}
                  placeholder="e.g. Rack B-4"
                />
                <p className="text-xs text-muted-foreground">Shown at POS so staff can find the box fast.</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Expiry date</Label>
              <DateInput
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

      {/* Oil shops sell the same litre of oil by the bottle and by the drum. */}
      {!isService && isOilShop && (
        <SaleUnitsBuilder
          baseUnit={value.unit ?? "pcs"}
          basePrice={Number(value.price) || 0}
          value={value.sale_units ?? []}
          onChange={(sale_units) => set({ sale_units })}
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
              locations={locations}
              baseLowStock={value.low_stock_threshold ?? 5}
              hideLowStock={isService}
            />
          )}
        </div>
      )}
    </div>
  );
}
