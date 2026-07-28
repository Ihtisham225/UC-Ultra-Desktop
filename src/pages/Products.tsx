import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useShop } from "@/contexts/ShopContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Edit2, Trash2, ScanBarcode, Package as PackageIcon, Printer, RefreshCw, Eye, Layers, Upload } from "lucide-react";
import { ImportProductsDialog } from "@/components/ImportProductsDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { PageTip } from "@/components/PageTip";
import { BarcodeStickerDialog } from "@/components/BarcodeStickerDialog";
import { DetailsDialog } from "@/components/DetailsDialog";
import { useConfirm } from "@/components/ConfirmDialog";
import { usePagination } from "@/hooks/usePagination";
import { Pagination } from "@/components/Pagination";
import { useRowSelection } from "@/hooks/useRowSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { downloadCsv } from "@/lib/csv";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { generateSku, generateBarcode } from "@/lib/sku";
import { VariantsBuilder, type BuilderVariant } from "@/components/VariantsBuilder";
import { toast } from "sonner";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useProductsWithVariants } from "@/hooks/useProductsWithVariants";
import { upsertLocal, deleteLocal, notifyChange } from "@/lib/localDb";
import { CategorySelect, flattenCategories, type CategoryDto, type CategoryOption } from "@/components/CategorySelect";
import { BrandSelect, type BrandDto } from "@/components/BrandSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rpc } from "@/lib/apiClient";
import { v4 as uuid } from "uuid";

interface Variant {
  id?: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price_override: number | null;
  stock: number;
  // local-only flag for new rows that aren't persisted yet
  _new?: boolean;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  category_id: string | null;
  brand: string | null;
  brand_id: string | null;
  price: number;
  stock: number;
  low_stock_threshold: number;
  unit: string | null;
  is_active: boolean;
  product_variants?: Variant[];
}

interface EditingProduct extends Partial<Product> {
  variants?: Variant[];
  hasVariants?: boolean;
}

const blank: EditingProduct = { name: "", sku: "", barcode: "", unit: "pcs", hasVariants: false, variants: [] };

export default function Products() {
  usePageMeta({ title: "Products & Inventory — UCU", description: "Manage your product catalog, track stock levels, set prices and import in bulk.", path: "/products" });
  const { t } = useTranslation();
  const { currentShop, role } = useShop();
  const formatMoney = useFormatMoney();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(params.get("category"));
  const [brandFilter, setBrandFilter] = useState<string | null>(params.get("brand"));
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [brands, setBrands] = useState<BrandDto[]>([]);
  const [editing, setEditing] = useState<EditingProduct | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [stickerProduct, setStickerProduct] = useState<Product | null>(null);
  const [details, setDetails] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const sel = useRowSelection();

  const canEdit = role === "owner" || role === "manager";

  useEffect(() => { document.title = "UCU"; }, []);

  useEffect(() => {
    const q = params.get("q") ?? "";
    if (q !== search) setSearch(q);
    const cat = params.get("category");
    if (cat !== categoryFilter) setCategoryFilter(cat);
    const brand = params.get("brand");
    if (brand !== brandFilter) setBrandFilter(brand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const updateParams = (q: string, category: string | null, brand: string | null) => {
    const next: Record<string, string> = {};
    if (q) next.q = q;
    if (category) next.category = category;
    if (brand) next.brand = brand;
    setParams(next, { replace: true });
  };

  // Joined read: synced product rows are flat, variants live in their own
  // local table — this hook attaches `product_variants` to every product.
  const { data: items, loading, refresh: load } = useProductsWithVariants<Product>(
    currentShop?.id,
  );

  // Categories & brands feed the filter dropdowns (online-only; the products
  // themselves keep working offline).
  useEffect(() => {
    if (!currentShop) return;
    rpc<CategoryDto[]>("listCategoriesAction").then((rows) => setCategories(flattenCategories(rows))).catch(() => {});
    rpc<BrandDto[]>("listBrandsAction").then(setBrands).catch(() => {});
  }, [currentShop]);

  const startEdit = (p: Product) => {
    const variants = (p.product_variants ?? []).map((v) => ({ ...v }));
    setEditing({
      ...p,
      hasVariants: variants.length > 0,
      variants,
    });
  };

  const setVariants = (variants: BuilderVariant[]) => {
    setEditing((e) => (e ? { ...e, variants } : e));
  };

  const save = async () => {
    if (!editing || !currentShop) return;
    const name = editing.name?.trim() || "";
    if (!name) return toast.error(t("products.nameRequired"));

    const wantsVariants = !!editing.hasVariants;
    const variants = (editing.variants ?? []).map((v) => ({ ...v, name: v.name?.trim() || "" }));

    if (wantsVariants) {
      if (variants.length === 0) return toast.error(t("products.variantsRequired"));
      if (variants.some((v) => !v.name)) return toast.error(t("products.variantNameRequired"));
    }

    // Duplicate name detection (only on insert)
    if (!editing.id) {
      const existing = items.find((p) => p.name.trim().toLowerCase() === name.toLowerCase());
      if (existing) {
        const ok = await confirm({
          title: t("common.duplicateFound"),
          description: t("common.duplicateMessage", { name: existing.name }),
          confirmLabel: t("common.addAnyway"),
          variant: "default",
        });
        if (!ok) return;
      }
    }

    const sku = (editing.sku?.trim()) || generateSku(name);
    const barcode = editing.barcode?.trim() || generateBarcode();
    const now = new Date().toISOString();

    const low_stock_threshold =
      editing.low_stock_threshold === undefined ||
      editing.low_stock_threshold === null ||
      (editing.low_stock_threshold as unknown as string) === ""
        ? 5
        : Number(editing.low_stock_threshold) || 0;

    const productId = editing.id ?? uuid();
    const productPayload: Record<string, unknown> = {
      id: productId,
      shop_id: currentShop.id,
      name,
      sku,
      barcode,
      category: editing.category ?? null,
      category_id: editing.category_id ?? null,
      brand: editing.brand ?? null,
      brand_id: editing.brand_id ?? null,
      price: Number(editing.price) || 0,
      stock: editing.id
        ? (items.find((p) => p.id === editing.id)?.stock ?? 0)
        : 0,
      low_stock_threshold,
      unit: editing.unit || "pcs",
      is_active: editing.is_active !== false,
      updated_at: now,
      created_at: editing.id
        ? ((items.find((p) => p.id === editing.id) as any)?.created_at ?? now)
        : now,
    };

    await upsertLocal("products", productPayload, true);

    // Manage variants
    const existingVariants = items.find((p) => p.id === editing.id)?.product_variants ?? [];
    const keptIds = new Set(variants.filter((v) => v.id && !v._new).map((v) => v.id!));

    if (wantsVariants) {
      // Delete removed variants
      const toDelete = existingVariants.filter((v) => v.id && !keptIds.has(v.id)).map((v) => v.id!);
      for (const vid of toDelete) await deleteLocal("product_variants", vid, true);

      const variantSlug = (s: string) =>
        s
          .toUpperCase()
          .replace(/[^A-Z0-9\s/-]/g, "")
          .trim()
          .split(/[\s/]+/)
          .filter(Boolean)
          .join("-")
          .slice(0, 20) || "VAR";

      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const autoSku = `${sku}-${variantSlug(v.name)}`;
        await upsertLocal("product_variants", {
          id: v.id && !v._new ? v.id : uuid(),
          product_id: productId,
          shop_id: currentShop.id,
          name: v.name,
          sku: v.sku?.trim() || autoSku,
          barcode: v.barcode?.trim() || generateBarcode(),
          price_override:
            v.price_override === null || v.price_override === undefined || (v.price_override as unknown as string) === ""
              ? null
              : Number(v.price_override),
          low_stock_threshold,
          sort_order: i,
          updated_at: now,
        }, true);
      }
    } else {
      const toDelete = existingVariants.filter((v) => v.id).map((v) => v.id!);
      for (const vid of toDelete) await deleteLocal("product_variants", vid, true);
    }

    notifyChange("products");
    toast.success(editing.id ? t("products.productUpdated") : t("products.productAdded"));
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    const ok = await confirm({
      title: t("products.title"),
      description: t("products.deleteConfirm"),
      variant: "destructive",
    });
    if (!ok) return;
    const prod = items.find((p) => p.id === id);
    const variantIds = (prod?.product_variants ?? []).map((v) => v.id).filter(Boolean) as string[];
    for (const vid of variantIds) await deleteLocal("product_variants", vid, true);
    await deleteLocal("products", id, true);
    notifyChange("products");
    toast.success(t("common.deleted"));
    load();
  };

  // Category filter includes the whole subtree so picking a parent shows the
  // products of its sub-categories too.
  const categoryIds = (() => {
    if (!categoryFilter) return null;
    const ids = new Set<string>([categoryFilter]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of categories) {
        if (c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)) {
          ids.add(c.id);
          grew = true;
        }
      }
    }
    return ids;
  })();

  const filtered = items.filter((p) => {
    if (categoryIds && (!p.category_id || !categoryIds.has(p.category_id))) return false;
    if (brandFilter && p.brand_id !== brandFilter) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    if (p.name.toLowerCase().includes(q)) return true;
    if (p.sku?.toLowerCase().includes(q)) return true;
    if (p.barcode?.includes(q)) return true;
    // Also match variant names/skus/barcodes
    return (p.product_variants ?? []).some(
      (v) => v.name.toLowerCase().includes(q) || v.sku?.toLowerCase().includes(q) || v.barcode?.includes(q),
    );
  });

  const { page, pageSize, setPage, setPageSize, visible, totalItems } = usePagination(
    filtered,
    { key: "products", defaultSize: 20, resetDeps: [search, categoryFilter, brandFilter, items.length] },
  );

  const cur = currentShop?.currency ?? "USD";

  const visibleIds = visible.map((p) => p.id);

  const totalStock = (p: Product) => {
    const variants = p.product_variants ?? [];
    if (variants.length > 0) return variants.reduce((a, v) => a + Number(v.stock), 0);
    return Number(p.stock);
  };

  const bulkDelete = async () => {
    if (sel.count === 0) return;
    const ok = await confirm({
      title: t("bulk.deleteTitle"),
      description: t("bulk.deleteConfirm", { count: sel.count }),
      variant: "destructive",
    });
    if (!ok) return;
    const ids = sel.ids;
    for (const id of ids) {
      const prod = items.find((p) => p.id === id);
      const variantIds = (prod?.product_variants ?? []).map((v) => v.id).filter(Boolean) as string[];
      for (const vid of variantIds) await deleteLocal("product_variants", vid, true);
      await deleteLocal("products", id, true);
    }
    notifyChange("products");
    toast.success(t("bulk.deleted", { count: ids.length }));
    sel.clear();
    load();
  };

  const bulkExport = () => {
    const rows = items.filter((p) => sel.has(p.id));
    if (rows.length === 0) return toast.error(t("bulk.nothingExported"));
    downloadCsv(`products-${new Date().toISOString().slice(0, 10)}`, rows, [
      { header: "Name", value: (r) => r.name },
      { header: "SKU", value: (r) => r.sku ?? "" },
      { header: "Barcode", value: (r) => r.barcode ?? "" },
      { header: "Category", value: (r) => r.category ?? "" },
      { header: "Brand", value: (r) => r.brand ?? "" },
      { header: "Selling Price", value: (r) => r.price },
      { header: "Stock", value: (r) => totalStock(r) },
      { header: "Variants", value: (r) => (r.product_variants ?? []).length },
      { header: "Unit", value: (r) => r.unit ?? "" },
      { header: "Low Stock At", value: (r) => r.low_stock_threshold },
      { header: "Active", value: (r) => (r.is_active ? "yes" : "no") },
    ]);
    toast.success(t("bulk.exported", { count: rows.length }));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("products.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("products.itemsInCatalog", { count: items.length })}</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button size="lg" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4 mr-2" /> Import
            </Button>
            <Button size="lg" onClick={() => setEditing({ ...blank, variants: [] })} className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
              <Plus className="size-4 mr-2" /> {t("products.addNew")}
            </Button>
          </div>
        )}
      </header>

      <PageTip id="products.intro" title="Products are the heart of your shop">
        Every line here can be sold at POS. Set a <b>low-stock threshold</b> to get warned before you run out, add a <b>barcode</b> to scan
        at checkout, and use <b>variants</b> (size / color / flavor) when one product has several options. Tap <b>Import</b> to load a CSV.
      </PageTip>

      <div className="flex flex-wrap gap-2">

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder={t("products.searchPlaceholder")} aria-label={t("products.searchPlaceholder")} value={search} onChange={(e) => { setSearch(e.target.value); updateParams(e.target.value, categoryFilter, brandFilter); }} className="ps-9" />
        </div>
        <Select
          value={categoryFilter ?? "__all__"}
          onValueChange={(v) => {
            const next = v === "__all__" ? null : v;
            setCategoryFilter(next);
            updateParams(search, next, brandFilter);
          }}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {`${"   ".repeat(c.depth)}${c.depth > 0 ? "↳ " : ""}${c.name}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={brandFilter ?? "__all__"}
          onValueChange={(v) => {
            const next = v === "__all__" ? null : v;
            setBrandFilter(next);
            updateParams(search, categoryFilter, next);
          }}
        >
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by brand">
            <SelectValue placeholder="All brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All brands</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setScannerOpen(true)} aria-label="Scan barcode"><ScanBarcode className="size-4" /></Button>
      </div>

      <BulkActionBar
        selectedCount={sel.count}
        onClear={sel.clear}
        onExport={bulkExport}
        onDelete={canEdit ? bulkDelete : undefined}
        canDelete={canEdit}
      />

      {(() => {
        const totalProducts = items.length;
        const totalUnits = items.reduce((a, p) => a + totalStock(p), 0);
        const totalInventoryValue = items.reduce((a, p) => a + Number(p.price) * totalStock(p), 0);
        const lowStockCount = items.filter((p) => totalStock(p) <= Number(p.low_stock_threshold)).length;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("products.title")}</div>
              <div className="text-lg sm:text-2xl font-bold tabular-nums mt-1 break-words leading-tight">{totalProducts}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Total stock</div>
              <div className="text-lg sm:text-2xl font-bold tabular-nums mt-1 break-words leading-tight">{totalUnits}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Inventory value</div>
              <div className="text-lg sm:text-2xl font-bold tabular-nums mt-1 break-words leading-tight">{formatMoney(totalInventoryValue, cur)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">if all sold at list price</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Low stock</div>
              <div className={`text-lg sm:text-2xl font-bold tabular-nums mt-1 break-words leading-tight ${lowStockCount > 0 ? "text-warning" : ""}`}>{lowStockCount}</div>
            </Card>
          </div>
        );
      })()}

      <Card className="shadow-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">{t("common.loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <PackageIcon className="size-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">{t("products.empty")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 w-10">
                    <Checkbox
                      checked={sel.allChecked(visibleIds) ? true : sel.someChecked(visibleIds) ? "indeterminate" : false}
                      onCheckedChange={(v) => sel.setAll(visibleIds, !!v)}
                      aria-label="select all"
                    />
                  </th>
                  <th className="text-start p-3 font-semibold">{t("common.name")}</th>
                  <th className="text-start p-3 font-semibold hidden md:table-cell">{t("products.sku")} / {t("products.barcode")}</th>
                  <th className="text-end p-3 font-semibold">{t("common.price")}</th>
                  <th className="text-end p-3 font-semibold">{t("common.stock")}</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const variantsCount = (p.product_variants ?? []).length;
                  const stock = totalStock(p);
                  const low = stock <= Number(p.low_stock_threshold);
                  return (
                    <tr key={p.id} className={`border-t hover:bg-muted/30 ${sel.has(p.id) ? "bg-primary/5" : ""}`}>
                      <td className="p-3">
                        <Checkbox
                          checked={sel.has(p.id)}
                          onCheckedChange={(v) => sel.toggle(p.id, !!v)}
                          aria-label={`select ${p.name}`}
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-medium flex items-center gap-2">
                          {p.name}
                          {variantsCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide bg-accent/15 text-accent-foreground rounded px-1.5 py-0.5 font-semibold">
                              <Layers className="size-3" /> {t("products.variantsCount", { count: variantsCount })}
                            </span>
                          )}
                        </div>
                        {(p.category || p.brand) && (
                          <div className="text-xs text-muted-foreground">
                            {[p.category, p.brand].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </td>
                      <td className="p-3 hidden md:table-cell font-mono text-xs text-muted-foreground">
                        {p.sku || "—"} {p.barcode && <span className="ms-2">· {p.barcode}</span>}
                      </td>
                      <td className="p-3 text-end font-semibold">{formatMoney(p.price, cur)}</td>
                      <td className={`p-3 text-end font-mono font-semibold ${low ? "text-warning" : ""}`}>
                        {stock} {p.unit}
                      </td>
                      <td className="p-3 text-end whitespace-nowrap">
                        <Button variant="ghost" size="icon" title={t("common.details")} onClick={() => setDetails(p)}>
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t("products.printSticker")}
                          onClick={() => setStickerProduct(p)}
                          disabled={!p.barcode}
                        >
                          <Printer className="size-4" />
                        </Button>
                        {canEdit && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => startEdit(p)}><Edit2 className="size-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => remove(p.id)}><Trash2 className="size-4 text-destructive" /></Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination
              page={page}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? t("products.edit") : t("products.newProduct")}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("common.name")} *</Label>
                  <Input
                    value={editing.name ?? ""}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    onBlur={() => {
                      if (editing && !editing.sku && editing.name) {
                        setEditing({ ...editing, sku: generateSku(editing.name) });
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("products.skuAuto")}</Label>
                  <div className="flex gap-2">
                    <Input
                      value={editing.sku ?? ""}
                      placeholder={t("products.skuPlaceholder")}
                      onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title={t("products.regenerateSku")}
                      onClick={() => setEditing({ ...editing, sku: generateSku(editing.name || "") })}
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("products.sellingPrice")} *</Label>
                  <Input type="number" step="0.01" min="0" value={editing.price ?? ""} onChange={(e) => setEditing({ ...editing, price: e.target.value === "" ? undefined : parseFloat(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("products.lowAt")}</Label>
                  <Input type="number" step="0.01" value={editing.low_stock_threshold ?? ""} onChange={(e) => setEditing({ ...editing, low_stock_threshold: e.target.value === "" ? undefined : parseFloat(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("products.unit")}</Label>
                  <Input value={editing.unit ?? "pcs"} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <CategorySelect
                    value={editing.category_id ?? null}
                    onChange={(id, catName) => setEditing({ ...editing, category_id: id, category: catName })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Brand</Label>
                  <BrandSelect
                    value={editing.brand_id ?? null}
                    onChange={(id, brandName) => setEditing({ ...editing, brand_id: id, brand: brandName })}
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-card p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="hasVariants" className="cursor-pointer flex items-center gap-2">
                    <Layers className="size-4 text-primary" />
                    {t("products.hasVariants")}
                  </Label>
                  <Switch
                    id="hasVariants"
                    checked={!!editing.hasVariants}
                    onCheckedChange={(checked) => {
                      setEditing({
                        ...editing,
                        hasVariants: checked,
                        variants: checked ? (editing.variants ?? []) : [],
                      });
                    }}
                  />
                </div>

                {editing.hasVariants && (
                  <VariantsBuilder
                    productName={editing.name ?? ""}
                    basePrice={Number(editing.price) || 0}
                    value={(editing.variants ?? []) as BuilderVariant[]}
                    onChange={setVariants}
                  />
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
            <Button onClick={save} className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
              {editing?.id ? t("common.saveChanges") : t("products.addNew")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          setSearch(code);
          toast.success(t("products.scanned", { code }));
        }}
      />

      {stickerProduct && (
        <BarcodeStickerDialog
          open={!!stickerProduct}
          onClose={() => setStickerProduct(null)}
          product={stickerProduct}
        />
      )}

      {details && (
        <DetailsDialog
          open={!!details}
          onClose={() => setDetails(null)}
          title={details.name}
          subtitle={[details.category, details.brand].filter(Boolean).join(" · ") || undefined}
          rows={[
            { label: "Brand", value: details.brand ?? "—" },
            { label: t("products.sku"), value: details.sku ?? "—" },
            { label: t("products.barcode"), value: details.barcode ?? "—" },
            { label: t("products.sellingPrice"), value: formatMoney(details.price, cur) },
            { label: t("common.stock"), value: `${totalStock(details)} ${details.unit ?? ""}` },
            { label: t("products.lowStockAt"), value: `${Number(details.low_stock_threshold)} ${details.unit ?? ""}` },
            { label: t("common.status"), value: details.is_active ? t("common.active") : t("common.inactive") },
            ...((details.product_variants ?? []).length > 0
              ? [{
                  label: t("products.variants"),
                  full: true,
                  value: (
                    <div className="border rounded-md divide-y mt-1">
                      {(details.product_variants ?? []).map((v) => (
                        <div key={v.id} className="flex justify-between p-2 text-xs gap-2">
                          <span className="min-w-0 flex-1 truncate">
                            {v.name}
                            {v.sku && <span className="ms-2 font-mono text-muted-foreground">{v.sku}</span>}
                          </span>
                          <span className="tabular-nums shrink-0">
                            {formatMoney(v.price_override ?? details.price, cur)} · {Number(v.stock)} {details.unit ?? ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  ),
                }]
              : []),
          ]}
          footer={canEdit ? (
            <Button variant="outline" onClick={() => { startEdit(details); setDetails(null); }}>{t("common.edit")}</Button>
          ) : null}
        />
      )}
      {currentShop && (
        <ImportProductsDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          shopId={currentShop.id}
          onImported={load}
        />
      )}
      {confirmDialog}
    </div>
  );
}
