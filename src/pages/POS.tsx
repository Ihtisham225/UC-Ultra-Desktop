import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useShop } from "@/contexts/ShopContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScanBarcode, Search, Plus, Minus, X, Trash2, Receipt, Layers, Tag, WifiOff, RefreshCw, FlaskConical } from "lucide-react";
import { useOfflineProducts } from "@/hooks/useOfflineProducts";
import { upsertLocal, notifyChange } from "@/lib/localDb";
import { v4 as uuid } from "uuid";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { toast } from "sonner";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import { CustomerPicker, type CustomerLite } from "@/components/CustomerPicker";
import { PatientPicker, type PatientLite } from "@/components/PatientPicker";
import { LabTokenDialog, type LabTokenOrder } from "@/components/LabTokenDialog";
import { rpc } from "@/lib/apiClient";
import { syncAll } from "@/lib/syncEngine";
import type { LabOrderDto } from "@/lib/labTypes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VariantPickerDialog, type VariantOption } from "@/components/VariantPickerDialog";
import { usePageMeta } from "@/hooks/usePageMeta";
import { cn } from "@/lib/utils";

interface Variant {
  id: string;
  product_id: string;
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
interface Product {
  id: string;
  name: string;
  barcode: string | null;
  price: number;
  stock: number;
  imei1?: string | null;
  imei2?: string | null;
  expiry_date?: string | null;
  batch_no?: string | null;
  generic_name?: string | null;
  shelf_location?: string | null;
  is_service?: boolean;
  variants?: Variant[];
}
/** Expiry status for pharmacy stock: null when no date or comfortably fresh. */
const expiryStatus = (d?: string | null): "expired" | "soon" | null => {
  if (!d) return null;
  const days = Math.floor((new Date(d + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (days < 0) return "expired";
  if (days <= 30) return "soon";
  return null;
};

/** Last-5-digit tail of an IMEI so staff know which handset a line refers to. */
const imeiTail = (s?: string | null) => (s && s.length > 5 ? `…${s.slice(-5)}` : (s || ""));

interface CartItem {
  /** Unique cart key: variant_id if present else product_id */
  key: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  /** available stock at the time of add (used for client-side checks) */
  stock: number;
  /** Serial(s) of the unit sold — captured at checkout for phone shops. */
  imei1?: string;
  imei2?: string;
  /** Services have no stock, so quantity is never capped. */
  is_service?: boolean;
  /** Lab tests are billed to a patient, not a customer. */
  is_lab_test?: boolean;
}

export default function POS() {
  const { user } = useAuth();
  const { currentShop } = useShop();
  const { t } = useTranslation();
  usePageMeta({
    title: "Point of Sale — UCU",
    description: "Ring up sales, scan barcodes, apply discounts and print receipts from any device.",
  });
  const formatMoney = useFormatMoney();
  const { products, isOnline, lastSynced, refresh } = useOfflineProducts(currentShop?.id);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "mobile" | "other">("cash");
  const [isCredit, setIsCredit] = useState(false);
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [completedSale, setCompletedSale] = useState<any | null>(null);
  const [customer, setCustomer] = useState<CustomerLite | null>(null);
  const [patient, setPatient] = useState<PatientLite | null>(null);
  const [labTokens, setLabTokens] = useState<LabTokenOrder[] | null>(null);
  const [variantPicker, setVariantPicker] = useState<Product | null>(null);
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState<string>("");

  // Pharmacies with a lab split the catalog: goods vs lab tests.
  const labEnabled = !!currentShop?.lab_tests_enabled;
  const [posTab, setPosTab] = useState<"products" | "lab">("products");
  /**
   * Which services are real lab tests (i.e. have factors defined) is only known
   * server-side, so cache the id set per shop: fresh when online, last-known
   * when offline. Without it we'd fall back to "any service", which would put
   * repair labour on the Lab tab and let it be sold as a test that never
   * reaches the lab queue.
   */
  const [labTestIds, setLabTestIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!labEnabled || !currentShop) return;
    const key = `ucu.labTestIds.${currentShop.id}`;
    try {
      const cached = localStorage.getItem(key);
      if (cached) setLabTestIds(new Set(JSON.parse(cached) as string[]));
    } catch { /* ignore */ }
    if (!navigator.onLine) return;
    rpc<{ id: string; is_lab_test: boolean }[]>("loadPosProductsAction")
      .then((rows) => {
        const ids = rows.filter((r) => r.is_lab_test).map((r) => r.id);
        setLabTestIds(new Set(ids));
        try { localStorage.setItem(key, JSON.stringify(ids)); } catch { /* ignore */ }
      })
      .catch(() => { /* offline / server hiccup — keep the cached set */ });
  }, [labEnabled, currentShop]);

  const isLabTest = useCallback(
    (p: { id: string; is_service?: boolean }) =>
      labEnabled && (labTestIds ? labTestIds.has(p.id) : !!p.is_service),
    [labEnabled, labTestIds],
  );
  const isPhone = currentShop?.store_type === "phone";
  const imeiOnProduct = isPhone && currentShop?.imei_capture_mode === "product";
  const imeiOnSale = isPhone && currentShop?.imei_capture_mode !== "product";

  useEffect(() => { document.title = `${t("nav.pos")} — UCU`; }, [t]);

  /** Add a (product, optional variant) to the cart. */
  const pushToCart = (p: Product, v: Variant | null) => {
    const stock = Number(v ? v.stock : p.stock);
    // Services have no stock to run out of.
    if (!p.is_service && stock <= 0) { toast.error(t("pos.outOfStock")); return; }
    const exp = expiryStatus(v ? v.expiry_date : p.expiry_date);
    if (exp === "expired") toast.error(`${p.name} has EXPIRED — check before selling`);
    else if (exp === "soon") toast.warning(`${p.name} expires within 30 days`);
    const key = v ? v.id : p.id;
    const unit_price = v ? Number(v.price_override ?? p.price) : Number(p.price);
    const display_name = v ? `${p.name} — ${v.name}` : p.name;
    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      const currentQty = existing?.quantity ?? 0;
      if (!p.is_service && currentQty + 1 > stock) {
        toast.error(t("pos.insufficientStock", { name: display_name }));
        return prev;
      }
      if (existing) return prev.map((c) => c.key === key ? { ...c, quantity: c.quantity + 1 } : c);
      const src = (v ?? p) as { imei1?: string | null; imei2?: string | null };
      return [...prev, {
        key,
        product_id: p.id,
        variant_id: v?.id ?? null,
        product_name: display_name,
        unit_price,
        quantity: 1,
        stock,
        imei1: imeiOnProduct ? (src.imei1 ?? undefined) : undefined,
        imei2: imeiOnProduct ? (src.imei2 ?? undefined) : undefined,
        is_service: p.is_service,
        is_lab_test: isLabTest(p),
      }];
    });
  };

  const handleProductClick = (p: Product) => {
    if (p.variants && p.variants.length > 0) {
      setVariantPicker(p);
    } else {
      pushToCart(p, null);
    }
  };

  const updateQty = (key: string, delta: number) => {
    setCart((prev) => prev
      .map((c) => {
        if (c.key !== key) return c;
        const newQty = c.quantity + delta;
        if (delta > 0 && !c.is_service && newQty > c.stock) {
          toast.error(t("pos.insufficientStock", { name: c.product_name }));
          return c;
        }
        return { ...c, quantity: newQty };
      })
      .filter((c) => c.quantity > 0));
  };

  const removeItem = (key: string) => setCart((prev) => prev.filter((c) => c.key !== key));

  const handleScanned = (code: string) => {
    // 1) Variant barcode wins
    for (const p of products) {
      const v = p.variants?.find((x) => x.barcode === code);
      if (v) { pushToCart(p, v); toast.success(`Added: ${p.name} — ${v.name}`); return; }
    }
    // 2) Product barcode
    const p = products.find((x) => x.barcode === code);
    if (p) {
      if (p.variants && p.variants.length > 0) {
        setVariantPicker(p);
      } else {
        pushToCart(p, null);
        toast.success(`Added: ${p.name}`);
      }
      return;
    }
    toast.error(`No product with barcode ${code}`);
  };

  const filtered = useMemo(() => {
    // Lab-enabled pharmacies keep tests on their own tab so the goods grid
    // stays clean; everyone else sees one combined catalog.
    // In a lab-enabled pharmacy the Service toggle *is* the lab-test marker,
    // so the offline cache doesn't need a separate flag.
    const base = labEnabled
      ? products.filter((p) => (posTab === "lab" ? isLabTest(p) : !isLabTest(p)))
      : products;
    if (!search) return base;
    const q = search.toLowerCase();
    return base.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.generic_name?.toLowerCase().includes(q) ||
      p.barcode?.includes(q) ||
      p.variants?.some((v) => v.name.toLowerCase().includes(q) || v.sku?.toLowerCase().includes(q) || v.barcode?.includes(q))
    );
  }, [products, search, labEnabled, posTab, isLabTest]);

  const subtotal = cart.reduce((a, c) => a + c.unit_price * c.quantity, 0);
  const taxRate = Number(currentShop?.tax_rate ?? 0);
  const discountInput = parseFloat(discountValue) || 0;
  const rawDiscount = discountType === "percent"
    ? (subtotal * discountInput) / 100
    : discountInput;
  const discount = Math.max(0, Math.min(rawDiscount, subtotal));
  const discountedSubtotal = subtotal - discount;
  const tax = (discountedSubtotal * taxRate) / 100;
  const total = discountedSubtotal + tax;
  const paid = parseFloat(amountPaid) || 0;
  const effectivePaid = isCredit ? paid : (paymentMethod === "cash" ? paid : total);
  const change = !isCredit && paymentMethod === "cash" ? Math.max(0, paid - total) : 0;
  const owed = Math.max(0, total - effectivePaid);
  const cur = currentShop?.currency ?? "USD";

  // A cart holding lab tests is billed to a patient, so the counter collects
  // the clinical details here — the lab shouldn't have to chase them later.
  const hasLabTests = cart.some((c) => c.is_lab_test);
  const payer = hasLabTests ? patient : customer;

  const completeSale = async () => {
    if (!user || !currentShop || cart.length === 0) return;
    if (!isCredit && paymentMethod === "cash" && paid < total) return toast.error("Amount paid is less than total");
    if (hasLabTests && !patient) return toast.error("Select a patient for the lab test");
    if (isCredit && !payer) return toast.error(hasLabTests ? "Select a patient for credit sale" : "Select a customer for credit sale");
    if (isCredit && effectivePaid > total) return toast.error("Paid cannot exceed total");

    setBusy(true);
    const now = new Date().toISOString();
    const receiptNumber = `R-${Date.now().toString(36).toUpperCase()}`;
    const saleId = uuid();
    const saleRecord: Record<string, unknown> = {
      id: saleId,
      shop_id: currentShop.id,
      cashier_id: user.id,
      customer_id: hasLabTests ? null : (customer?.id ?? null),
      // Snapshotted with the sale so the lab order raised on sync (and the
      // printed report) keeps the patient even if the register changes.
      patient_id: hasLabTests ? (patient?.id ?? null) : null,
      patient_name: hasLabTests ? (patient?.name ?? null) : null,
      patient_phone: hasLabTests ? (patient?.phone ?? null) : null,
      patient_age: hasLabTests ? (patient?.age ?? null) : null,
      patient_gender: hasLabTests ? (patient?.gender ?? null) : null,
      subtotal, tax, discount, total,
      amount_paid: effectivePaid,
      change_due: change,
      payment_method: paymentMethod,
      receipt_number: receiptNumber,
      updated_at: now,
      created_at: now,
    };

    await upsertLocal("sales", saleRecord, true);

    const itemRows = cart.map((c) => ({
      id: uuid(),
      sale_id: saleId,
      shop_id: currentShop.id,   // synthetic — for local IDB index only
      product_id: c.product_id,
      variant_id: c.variant_id,
      product_name: c.product_name,
      unit_price: c.unit_price,
      quantity: c.quantity,
      line_total: c.unit_price * c.quantity,
      // IMEI(s) of the specific unit sold, entered at checkout (phone shops).
      imei1: c.imei1?.trim() || null,
      imei2: c.imei2?.trim() || null,
      created_at: now,
    }));

    for (const item of itemRows) {
      await upsertLocal("sale_items", item, true);
    }

    if (isCredit && owed > 0 && payer) {
      await upsertLocal("debts", {
        id: uuid(),
        shop_id: currentShop.id,
        created_by: user.id,
        direction: "owed_to_me",
        person_name: payer.name,
        phone: payer.phone ?? null,
        amount: owed,
        paid_amount: 0,
        currency: cur,
        status: "open",
        notes: `Sale ${receiptNumber}${effectivePaid > 0 ? ` (partial paid ${effectivePaid})` : ""}`,
        updated_at: now,
        created_at: now,
      }, true);
      toast.success(`Credit of ${formatMoney(owed, cur)} recorded for ${payer.name}`);
    }

    notifyChange("sales");
    notifyChange("sale_items");

    setBusy(false);
    setCompletedSale({ ...saleRecord, items: itemRows, shop: currentShop, customer });
    setCart([]); setAmountPaid(""); setCustomer(null); setPatient(null); setDiscountValue(""); setIsCredit(false);
    toast.success("Sale completed!");
    refresh();

    // Lab orders (and their tokens) are raised server-side when the sale is
    // pushed, so grab them once the queue has drained. Offline, the tokens are
    // issued on the next sync and can be printed from the Lab screen.
    if (hasLabTests) {
      if (!navigator.onLine) {
        toast.info("Offline — the lab token will be issued when this terminal syncs.");
      } else {
        try {
          await syncAll();
          const orders = await rpc<LabOrderDto[]>("listLabOrdersForSaleAction", saleId);
          if (orders.length > 0) setLabTokens(orders);
        } catch {
          toast.info("Lab token will appear in the Lab screen once this sale syncs.");
        }
      }
    }
  };

  const variantOptions: VariantOption[] = useMemo(() => {
    if (!variantPicker) return [];
    return (variantPicker.variants ?? []).map((v) => ({
      id: v.id, name: v.name, sku: v.sku, barcode: v.barcode,
      price_override: v.price_override, stock: Number(v.stock),
      imei1: v.imei1, imei2: v.imei2,
      expiry_date: v.expiry_date, batch_no: v.batch_no,
    }));
  }, [variantPicker]);

  return (
    <div className="max-w-7xl mx-auto grid md:grid-cols-[1fr_380px] lg:grid-cols-[1fr_420px] gap-4 md:gap-6 md:h-[calc(100vh-9rem)] md:min-h-[620px]">
      <h1 className="sr-only">Point of Sale</h1>
      <div className="flex flex-col min-h-0 order-2 md:order-1">
        {labEnabled && (
          <div className="inline-flex rounded-lg border bg-muted/40 p-1 mb-3 self-start">
            <button type="button" onClick={() => setPosTab("products")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${posTab === "products" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              Products
            </button>
            <button type="button" onClick={() => setPosTab("lab")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors inline-flex items-center gap-1.5 ${posTab === "lab" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <FlaskConical className="size-3.5" /> Lab Tests
            </button>
          </div>
        )}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              autoFocus placeholder={t("pos.searchProducts")} value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  // Try barcode-style match across products + variants first
                  const code = search.trim();
                  if (code) {
                    for (const p of products) {
                      const v = p.variants?.find((x) => x.barcode === code);
                      if (v) { pushToCart(p, v); setSearch(""); return; }
                    }
                    const exact = products.find((p) => p.barcode === code);
                    if (exact) { handleProductClick(exact); setSearch(""); return; }
                  }
                  if (filtered[0]) { handleProductClick(filtered[0]); setSearch(""); }
                }
              }}
              className="ps-9 h-12 text-base"
            />
          </div>
          <Button variant="outline" size="lg" onClick={() => setScannerOpen(true)} aria-label={t("pos.scanBarcode")}>
            <ScanBarcode className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-12 w-12 shrink-0" onClick={refresh} title="Sync products">
            <RefreshCw className="size-4" />
          </Button>
        </div>

        {/* Online / offline status bar */}
        {!isOnline && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            <WifiOff className="size-4 shrink-0" />
            <span>Offline — showing cached products. Sales will sync when back online.</span>
          </div>
        )}
        {isOnline && lastSynced && (
          <div className="text-[11px] text-muted-foreground px-1">
            Last synced: {lastSynced.toLocaleTimeString()}
          </div>
        )}

        <div className="md:flex-1 md:overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">{t("common.noResults")}</Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((p) => {
                const hasVariants = (p.variants?.length ?? 0) > 0;
                const totalStock = hasVariants
                  ? p.variants!.reduce((s, v) => s + Number(v.stock), 0)
                  : Number(p.stock);
                return (
                  <button
                    key={p.id}
                    onClick={() => handleProductClick(p)}
                    disabled={!p.is_service && totalStock <= 0}
                    className="text-start p-3 rounded-xl border bg-card hover:border-primary hover:shadow-card transition-all disabled:opacity-40 disabled:cursor-not-allowed group relative overflow-hidden w-full min-w-0"
                  >
                    {hasVariants && (
                      <span className="absolute top-2 end-2 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[10px] font-medium px-1.5 py-0.5">
                        <Layers className="size-3" />{p.variants!.length}
                      </span>
                    )}
                    <div className="font-semibold text-sm leading-snug group-hover:text-primary mb-2 pr-6 line-clamp-3">{p.name}</div>
                    <div className={cn("font-bold break-all", formatMoney(p.price, cur).length > 12 ? "text-sm" : "text-base")}>{formatMoney(p.price, cur)}</div>
                    {/* Lab tests have nothing to stock — showing a count (often
                        negative from older sales) only confuses the counter. */}
                    {!isLabTest(p) && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {p.is_service ? "Service" : `${t("common.stock")}: ${totalStock}`}
                      </div>
                    )}
                    {imeiOnProduct && !hasVariants && (p.imei1 || p.imei2) && (
                      <div className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">IMEI {imeiTail(p.imei1 || p.imei2)}</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Card className="flex flex-col shadow-elevated overflow-hidden order-1 md:order-2 md:max-h-full">
        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
          <div className="font-semibold flex items-center gap-2"><Receipt className="size-4" /> {t("pos.cart")}</div>
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setCart([])}><Trash2 className="size-4 me-1" /> {t("common.delete")}</Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 min-h-[160px]">
          {cart.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-8 text-center">
              {t("pos.cartEmpty")}
            </div>
          ) : (
            <ul className="space-y-1">
              {cart.map((c) => (
                <li key={c.key} className="p-3 rounded-lg hover:bg-muted/40 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{c.product_name}</div>
                    </div>
                    <div className="font-semibold tabular-nums">{formatMoney(c.unit_price * c.quantity, cur)}</div>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <Button size="icon" variant="outline" className="size-7" onClick={() => updateQty(c.key, -1)}><Minus className="size-3" /></Button>
                    <span className="w-8 text-center font-mono text-sm">{c.quantity}</span>
                    <Button size="icon" variant="outline" className="size-7" onClick={() => updateQty(c.key, 1)}><Plus className="size-3" /></Button>
                    <div className="ms-auto flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">{t("pos.price") ?? "Price"}</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={c.unit_price}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setCart((prev) => prev.map((x) => x.key === c.key ? { ...x, unit_price: isNaN(v) ? 0 : v } : x));
                        }}
                        className="h-7 w-20 text-xs px-2 tabular-nums"
                      />
                    </div>
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => removeItem(c.key)}><X className="size-3" /></Button>
                  </div>
                  {imeiOnSale && (
                    <div className="grid grid-cols-2 gap-1 mt-2">
                      <Input
                        value={c.imei1 ?? ""}
                        onChange={(e) => setCart((prev) => prev.map((x) => x.key === c.key ? { ...x, imei1: e.target.value } : x))}
                        placeholder="IMEI 1" inputMode="numeric" className="h-7 text-xs px-2"
                      />
                      <Input
                        value={c.imei2 ?? ""}
                        onChange={(e) => setCart((prev) => prev.map((x) => x.key === c.key ? { ...x, imei2: e.target.value } : x))}
                        placeholder="IMEI 2 (dual SIM)" inputMode="numeric" className="h-7 text-xs px-2"
                      />
                    </div>
                  )}
                  {imeiOnProduct && (c.imei1 || c.imei2) && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.imei1 && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">IMEI {imeiTail(c.imei1)}</span>}
                      {c.imei2 && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">IMEI2 {imeiTail(c.imei2)}</span>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t p-4 space-y-3 bg-card">
          {hasLabTests
            ? <PatientPicker value={patient} onChange={setPatient} />
            : <CustomerPicker value={customer} onChange={setCustomer} />}

          <div className="flex items-center gap-2">
            <Tag className="size-4 text-muted-foreground shrink-0" />
            <div className="relative flex-1 min-w-0">
              <Input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="Discount"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="pe-16 h-9"
              />
              {discountValue && rawDiscount > subtotal && (
                <span className="absolute -bottom-4 left-0 text-[10px] text-warning">capped at subtotal</span>
              )}
            </div>
            <Select value={discountType} onValueChange={(v) => setDiscountType(v as any)}>
              <SelectTrigger className="w-20 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="amount">{cur}</SelectItem>
                <SelectItem value="percent">%</SelectItem>
              </SelectContent>
            </Select>
            {discountValue && (
              <Button variant="ghost" size="icon" className="size-9 shrink-0" onClick={() => setDiscountValue("")} title="Clear discount">
                <X className="size-4" />
              </Button>
            )}
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{t("common.subtotal")}</span><span className="tabular-nums">{formatMoney(subtotal, cur)}</span></div>
            {discount > 0 && (
              <div className="flex justify-between text-success">
                <span>Discount{discountType === "percent" && discountInput > 0 ? ` (${discountInput}%)` : ""}</span>
                <span className="tabular-nums">−{formatMoney(discount, cur)}</span>
              </div>
            )}
            {taxRate > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t("common.tax")} ({taxRate}%)</span><span className="tabular-nums">{formatMoney(tax, cur)}</span></div>}
            <div className="flex justify-between text-lg font-bold pt-1 border-t"><span>{t("common.total")}</span><span className="tabular-nums text-primary">{formatMoney(total, cur)}</span></div>
          </div>


          <div className="grid grid-cols-2 gap-2">
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">💵 {t("pos.cash")}</SelectItem>
                <SelectItem value="card">💳 {t("pos.card")}</SelectItem>
                <SelectItem value="mobile">📱 {t("pos.mobile")}</SelectItem>
                <SelectItem value="other">{t("pos.other")}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number" step="0.01" placeholder={isCredit ? "Amount paid now (0 if none)" : t("pos.amountPaid")}
              value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)}
              disabled={!isCredit && paymentMethod !== "cash"}
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none p-2 rounded-lg border border-dashed hover:bg-muted/40">
            <input
              type="checkbox"
              checked={isCredit}
              onChange={(e) => { setIsCredit(e.target.checked); if (e.target.checked) setAmountPaid(""); }}
              className="size-4"
            />
            <span className="font-medium">Credit / pay later</span>
            <span className="text-xs text-muted-foreground ms-auto">{hasLabTests ? "Requires patient" : "Requires customer"}</span>
          </label>

          {isCredit && owed > 0 && (
            <div className="text-sm flex justify-between bg-warning/10 text-warning px-3 py-2 rounded-lg font-medium">
              <span>To be paid later</span>
              <span className="tabular-nums">{formatMoney(owed, cur)}</span>
            </div>
          )}

          {!isCredit && paymentMethod === "cash" && paid > 0 && (
            paid >= total ? (
              <div className="text-sm flex justify-between bg-success/10 text-success px-3 py-2 rounded-lg font-medium">
                <span>{t("pos.changeDue")}</span>
                <span className="tabular-nums">{formatMoney(paid - total, cur)}</span>
              </div>
            ) : (
              <div className="text-sm flex justify-between bg-destructive/10 text-destructive px-3 py-2 rounded-lg font-medium">
                <span>Remaining</span>
                <span className="tabular-nums">{formatMoney(total - paid, cur)}</span>
              </div>
            )
          )}

          <Button
            disabled={cart.length === 0 || busy}
            onClick={completeSale}
            size="lg"
            className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground h-14 text-base font-semibold shadow-glow"
          >
            {busy ? t("common.processing") : isCredit
              ? `Save on credit · ${formatMoney(total, cur)}`
              : t("pos.charge", { amount: formatMoney(total, cur) })}
          </Button>
        </div>
      </Card>

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScanned} />
      {variantPicker && (
        <VariantPickerDialog
          open={!!variantPicker}
          onClose={() => setVariantPicker(null)}
          productName={variantPicker.name}
          basePrice={Number(variantPicker.price)}
          variants={variantOptions}
          onPick={(v) => {
            const variant = variantPicker.variants?.find((x) => x.id === v.id) ?? null;
            if (variant) pushToCart(variantPicker, variant);
          }}
        />
      )}
      {completedSale && (
        <ReceiptDialog sale={completedSale} onClose={() => setCompletedSale(null)} />
      )}
      <LabTokenDialog orders={labTokens} onClose={() => setLabTokens(null)} />
    </div>
  );
}
