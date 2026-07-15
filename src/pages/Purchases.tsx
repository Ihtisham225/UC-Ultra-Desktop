import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { rpc, uploadInvoiceImage } from "@/lib/apiClient";
import { useShop } from "@/contexts/ShopContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, X, PackageOpen, Truck, Eye, Edit2, Trash2, Search, Check, Undo2, Printer } from "lucide-react";
import { SupplierReturnDialog } from "@/components/SupplierReturnDialog";
import { PurchaseReceiptDialog } from "@/components/PurchaseReceiptDialog";
import { PageTip } from "@/components/PageTip";
import { DetailsDialog } from "@/components/DetailsDialog";
import { VariantPickerDialog } from "@/components/VariantPickerDialog";
import { useConfirm } from "@/components/ConfirmDialog";
import { Pagination } from "@/components/Pagination";
import { toast } from "sonner";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { format } from "date-fns";

const PAGE_SIZE_KEY = "pos.pageSize.purchases";
const DEFAULT_PAGE_SIZE = 20;

interface Supplier { id: string; name: string; phone: string | null; }
interface Variant {
  id: string; product_id: string; name: string;
  sku: string | null; barcode: string | null;
  price_override: number | null; stock: number;
}
interface Product { id: string; name: string; price: number; variants?: Variant[]; }
interface Purchase {
  id: string;
  reference_number: string | null;
  supplier_id: string | null;
  total: number;
  payment_method: string;
  created_at: string;
  invoice_image_url?: string | null;
}
interface Line {
  /** Cart key: variant_id if present else product_id */
  key: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  unit_cost: number | null;
  quantity: number;
  /** Landed-cost charges for the whole line (transport, loading, …). */
  expense_amount: number | null;
}

function InvoiceImage({ value }: { value: string }) {
  // Invoice images are now stored as public URLs (Vercel Blob) — render directly.
  return (
    <a href={value} target="_blank" rel="noreferrer">
      <img src={value} alt="invoice" className="max-h-64 rounded border mt-1" />
    </a>
  );
}

export default function Purchases() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currentShop, role } = useShop();
  const canDelete = role === "owner";
  const formatMoney = useFormatMoney();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [grandPaid, setGrandPaid] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState<number>(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(PAGE_SIZE_KEY) : null;
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_PAGE_SIZE;
  });
  const setPageSize = (n: number) => {
    setPageSizeState(n);
    setPage(1);
    try { localStorage.setItem(PAGE_SIZE_KEY, String(n)); } catch {}
  };
  const [open, setOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  /** When set, the open dialog is editing this purchase id instead of creating a new one. */
  const [editingId, setEditingId] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState<string>("");
  const [reference, setReference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "mobile" | "other">("cash");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [invoiceImageUrl, setInvoiceImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [newSupplier, setNewSupplier] = useState({ name: "", phone: "", email: "", notes: "" });
  const [details, setDetails] = useState<any | null>(null);
  const [printPurchase, setPrintPurchase] = useState<any | null>(null);
  const [detailsItemSearch, setDetailsItemSearch] = useState("");
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [supplierReturnFor, setSupplierReturnFor] = useState<string | null>(null);

  // Product-level search across purchase_items
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    if (!currentShop || !debouncedSearch) { setSearchResults([]); return; }
    let cancelled = false;
    (async () => {
      setSearching(true);
      try {
        const data = await rpc<any[]>("searchPurchaseItemsAction", debouncedSearch);
        if (!cancelled) setSearchResults(data ?? []);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedSearch, currentShop]);

  const searchSummary = useMemo(() => {
    if (!searchResults.length) return null;
    const totalQty = searchResults.reduce((a, r) => a + Number(r.quantity), 0);
    const totalCost = searchResults.reduce((a, r) => a + Number(r.line_total), 0);
    const avgCost = totalQty > 0 ? totalCost / totalQty : 0;
    const suppliers = new Map<string, { name: string; phone: string | null; qty: number; cost: number }>();
    searchResults.forEach((r) => {
      const sName = r.purchases?.suppliers?.name ?? "—";
      const sPhone = r.purchases?.suppliers?.phone ?? null;
      const cur = suppliers.get(sName) ?? { name: sName, phone: sPhone, qty: 0, cost: 0 };
      cur.qty += Number(r.quantity);
      cur.cost += Number(r.line_total);
      suppliers.set(sName, cur);
    });
    return { totalQty, totalCost, avgCost, suppliers: Array.from(suppliers.values()), purchaseCount: new Set(searchResults.map(r => r.purchases?.id)).size };
  }, [searchResults]);

  const openDetails = async (id: string) => {
    try {
      const data = await rpc<any>("getPurchaseDetailAction", id);
      if (data) {
        setDetailsItemSearch("");
        setDetails(data);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("purchases.failed"));
    }
  };

  const generateReference = () => {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `PO-${ymd}-${rand}`;
  };

  const startEdit = async (purchaseId: string) => {
    let data: any;
    try {
      data = await rpc<any>("getPurchaseDetailAction", purchaseId);
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : t("purchases.failed"));
    }
    if (!data) return toast.error(t("purchases.failed"));
    setEditingId(purchaseId);
    setSupplierId((data as any).supplier_id ?? "");
    setReference((data as any).reference_number ?? "");
    setPaymentMethod(((data as any).payment_method as any) ?? "cash");
    setNotes((data as any).notes ?? "");
    setInvoiceImageUrl((data as any).invoice_image_url ?? null);
    setLines((((data as any).purchase_items ?? []) as any[]).map((it) => ({
      key: it.variant_id ?? it.product_id ?? it.id,
      product_id: it.product_id ?? "",
      variant_id: it.variant_id ?? null,
      product_name: it.product_name,
      unit_cost: Number(it.unit_cost),
      quantity: Number(it.quantity),
      expense_amount: Number(it.expense_amount ?? 0) || null,
    })));
    setDetails(null);
    setOpen(true);
  };

  const deletePurchase = async (id: string) => {
    const ok = await confirm({
      title: t("purchases.deletePurchase"),
      description: t("purchases.deleteConfirm"),
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("deletePurchaseAction", id);
      if (!res.ok) return toast.error(res.error ?? t("purchases.failed"));
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : t("purchases.failed"));
    }
    toast.success(t("common.deleted"));
    load();
  };

  const cur = currentShop?.currency ?? "USD";

  useEffect(() => { document.title = "UCU"; }, []);

  const load = useCallback(async () => {
    if (!currentShop) return;
    setLoading(true);
    try {
      const [list, formData] = await Promise.all([
        rpc<{ rows: Purchase[]; count: number; grandTotal: number; grandPaid: number }>("listPurchasesAction", page, pageSize),
        rpc<{ suppliers: Supplier[]; products: Product[] }>("loadPurchaseFormDataAction"),
      ]);
      setPurchases(list.rows ?? []);
      setTotalCount(list.count ?? 0);
      setGrandTotal(list.grandTotal ?? 0);
      setGrandPaid(list.grandPaid ?? 0);
      setSuppliers(formData.suppliers ?? []);
      setProducts(formData.products ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("purchases.failed"));
    } finally {
      setLoading(false);
    }
  }, [currentShop, page, pageSize, t]);

  useEffect(() => { load(); }, [load]);

  // Clamp page if totals shrink (e.g. after deletes).
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [totalCount, pageSize, page]);

  const subtotal = useMemo(() => lines.reduce((a, l) => a + (l.unit_cost ?? 0) * l.quantity, 0), [lines]);
  const expensesTotal = useMemo(() => lines.reduce((a, l) => a + (l.expense_amount ?? 0), 0), [lines]);
  const [sharedExpense, setSharedExpense] = useState<string>("");

  /**
   * Split a shared charge (e.g. one transport bill) across the lines,
   * proportionally to each line's goods value (equally when all costs are
   * still blank). Rounded to 2dp; the rounding remainder lands on the last line.
   */
  const distributeShared = () => {
    const amount = parseFloat(sharedExpense) || 0;
    if (amount <= 0 || lines.length === 0) return;
    const values = lines.map((l) => (l.unit_cost ?? 0) * l.quantity);
    const totalValue = values.reduce((a, v) => a + v, 0);
    const shares = lines.map((_, i) =>
      totalValue > 0 ? (values[i] / totalValue) * amount : amount / lines.length,
    );
    let assigned = 0;
    const rounded = shares.map((sh, i) => {
      if (i === shares.length - 1) return Math.round((amount - assigned) * 100) / 100;
      const r = Math.round(sh * 100) / 100;
      assigned += r;
      return r;
    });
    setLines((prev) => prev.map((l, i) => ({
      ...l,
      expense_amount: Math.round(((l.expense_amount ?? 0) + rounded[i]) * 100) / 100,
    })));
    setSharedExpense("");
    toast.success(t("purchases.sharedSplit", { defaultValue: "Shared expense split across items" }));
  };

  const [variantPicker, setVariantPicker] = useState<Product | null>(null);

  const pushLine = (p: Product, v: Variant | null) => {
    const key = v ? v.id : p.id;
    if (lines.some((l) => l.key === key)) return toast.error(t("purchases.alreadyAdded"));
    const display_name = v ? `${p.name} — ${v.name}` : p.name;
    setLines((prev) => [...prev, {
      key,
      product_id: p.id,
      variant_id: v?.id ?? null,
      product_name: display_name,
      unit_cost: null,
      quantity: 1,
      expense_amount: null,
    }]);
  };

  const addLine = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    if ((p.variants?.length ?? 0) > 0) {
      setVariantPicker(p);
    } else {
      pushLine(p, null);
    }
  };

  const updateLine = (key: string, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l) => l.key === key ? { ...l, ...patch } : l));
  };

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const reset = () => {
    setEditingId(null);
    setSupplierId(""); setReference(generateReference()); setPaymentMethod("cash"); setNotes(""); setLines([]);
    setSharedExpense("");
    setInvoiceImageUrl(null);
  };

  const handleInvoiceUpload = async (file: File) => {
    if (!currentShop) return;
    if (file.size > 5 * 1024 * 1024) return toast.error(t("purchases.imageTooLarge"));
    setUploadingImage(true);
    try {
      const url = await uploadInvoiceImage(file);
      setInvoiceImageUrl(url);
      toast.success(t("purchases.imageUploaded"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("purchases.failed"));
    } finally {
      setUploadingImage(false);
    }
  };

  const save = async () => {
    if (!user || !currentShop) return;
    if (lines.length === 0) return toast.error(t("purchases.addAtLeastOne"));
    if (lines.some((l) => l.quantity <= 0 || l.unit_cost == null || l.unit_cost < 0)) return toast.error(t("purchases.invalidLine"));
    setBusy(true);

    const input = {
      supplier_id: supplierId || null,
      reference_number: reference || null,
      payment_method: paymentMethod,
      notes: notes || null,
      invoice_image_url: invoiceImageUrl,
      items: lines.map((l) => ({
        product_id: l.product_id || null,
        variant_id: l.variant_id || null,
        product_name: l.product_name,
        unit_cost: l.unit_cost ?? 0,
        quantity: l.quantity,
        expense_amount: l.expense_amount ?? 0,
      })),
    };
    try {
      const res = editingId
        ? await rpc<{ ok: boolean; error?: string }>("updatePurchaseAction", editingId, input)
        : await rpc<{ ok: boolean; id?: string; error?: string }>("createPurchaseAction", input);
      if (!res.ok) return toast.error(res.error ?? t("purchases.failed"));
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : t("purchases.failed"));
    } finally {
      setBusy(false);
    }
    toast.success(editingId ? t("purchases.purchaseUpdated") : t("purchases.saved"));
    setOpen(false);
    reset();
    load();
  };

  const saveSupplier = async () => {
    if (!currentShop || !newSupplier.name.trim()) return toast.error(t("purchases.nameRequired"));
    const name = newSupplier.name.trim();

    // Duplicate name detection
    const existing = suppliers.find((s) => s.name.trim().toLowerCase() === name.toLowerCase());
    if (existing) {
      const ok = await confirm({
        title: t("common.duplicateFound"),
        description: t("common.duplicateMessage", { name: existing.name }),
        confirmLabel: t("common.addAnyway"),
        variant: "default",
      });
      if (!ok) return;
    }

    let supplier: Supplier;
    try {
      const res = await rpc<{ ok: boolean; supplier?: Supplier; error?: string }>("createSupplierAction", {
        name,
        phone: newSupplier.phone || null,
        email: newSupplier.email || null,
        notes: newSupplier.notes || null,
      });
      if (!res.ok || !res.supplier) return toast.error(res.error ?? t("purchases.failed"));
      supplier = res.supplier;
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : t("purchases.failed"));
    }
    toast.success(t("purchases.supplierAdded"));
    setNewSupplier({ name: "", phone: "", email: "", notes: "" });
    setSupplierOpen(false);
    setSuppliers((prev) => [...prev, supplier]);
    setSupplierId(supplier.id);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PackageOpen className="size-6 text-primary" /> {t("purchases.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("purchases.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Truck className="size-4 mr-2" /> {t("purchases.addSupplier")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("purchases.newSupplier")}</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5"><Label>{t("common.name")}</Label>
                  <Input value={newSupplier.name} onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>{t("common.phone")}</Label>
                    <Input value={newSupplier.phone} onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>{t("common.email")}</Label>
                    <Input type="email" value={newSupplier.email} onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })} /></div>
                </div>
                <div className="space-y-1.5"><Label>{t("common.notes")}</Label>
                  <Textarea rows={2} value={newSupplier.notes} onChange={(e) => setNewSupplier({ ...newSupplier, notes: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSupplierOpen(false)}>{t("common.cancel")}</Button>
                <Button onClick={saveSupplier}>{t("common.save")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={(o) => {
            setOpen(o);
            if (!o) reset();
            else if (!editingId && !reference) setReference(generateReference());
          }}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4 mr-2" /> {t("purchases.newPurchase")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[calc(100dvh-1rem)] flex flex-col">
              <DialogHeader><DialogTitle>{editingId ? t("purchases.editPurchase") : t("purchases.recordPurchase")}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2 overflow-y-auto flex-1 -mx-4 sm:-mx-6 px-4 sm:px-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("purchases.supplier")}</Label>
                    <div className="flex gap-2">
                      <Select value={supplierId || "__none__"} onValueChange={(v) => setSupplierId(v === "__none__" ? "" : v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder={t("purchases.supplierNone")} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t("purchases.supplierNone")}</SelectItem>
                          {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" onClick={() => setSupplierOpen(true)} title={t("purchases.addSupplier")}>
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("purchases.reference")}</Label>
                    <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("purchases.referencePlaceholder")} />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <Label>{t("purchases.items")}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="w-full sm:w-60 justify-start">
                          <Plus className="size-4 mr-2" /> {t("purchases.addProductPlaceholder")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-0" align="end">
                        <Command>
                          <CommandInput placeholder={t("purchases.searchProducts")} autoFocus />
                          <CommandList>
                            <CommandEmpty>{t("purchases.noProducts")}</CommandEmpty>
                            <CommandGroup>
                              {products.map((p) => {
                                const hasVariants = (p.variants?.length ?? 0) > 0;
                                const added = hasVariants
                                  ? lines.some((l) => l.product_id === p.id)
                                  : lines.some((l) => l.key === p.id);
                                return (
                                  <CommandItem
                                    key={p.id}
                                    value={`${p.name}`}
                                    onSelect={() => addLine(p.id)}
                                    disabled={!hasVariants && added}
                                  >
                                    {added ? (
                                      <Check className="size-4 mr-2 text-primary" />
                                    ) : (
                                      <Plus className="size-4 mr-2 text-muted-foreground" />
                                    )}
                                    <span className="truncate">{p.name}</span>
                                    {hasVariants && (
                                      <span className="ml-auto text-xs text-muted-foreground">({p.variants!.length})</span>
                                    )}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {/* Desktop table */}
                  <div className="hidden sm:block border rounded-lg overflow-auto max-h-80">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("purchases.productCol")}</TableHead>
                          <TableHead className="w-32">{t("purchases.unitCost")}</TableHead>
                          <TableHead className="w-24">{t("purchases.qty")}</TableHead>
                          <TableHead className="w-32">{t("purchases.expenses", { defaultValue: "Expenses" })}</TableHead>
                          <TableHead className="w-32 text-end">{t("purchases.lineTotal")}</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-sm">{t("purchases.addProductFirst")}</TableCell></TableRow>
                        ) : lines.map((l) => (
                          <TableRow key={l.key}>
                            <TableCell className="font-medium">{l.product_name}</TableCell>
                            <TableCell className="p-2">
                              <Input type="number" inputMode="decimal" step="0.01" placeholder="0.00" value={l.unit_cost ?? ""}
                                className="h-9 px-2 text-sm tabular-nums"
                                onChange={(e) => {
                                  const v = e.target.value;
                                  updateLine(l.key, { unit_cost: v === "" ? null : (parseFloat(v) || 0) });
                                }} />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input type="number" inputMode="numeric" step="1" value={l.quantity}
                                className="h-9 px-2 text-sm tabular-nums"
                                onChange={(e) => updateLine(l.key, { quantity: parseFloat(e.target.value) || 0 })} />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input type="number" inputMode="decimal" step="0.01" placeholder="0.00" value={l.expense_amount ?? ""}
                                className="h-9 px-2 text-sm tabular-nums"
                                onChange={(e) => {
                                  const v = e.target.value;
                                  updateLine(l.key, { expense_amount: v === "" ? null : (parseFloat(v) || 0) });
                                }} />
                            </TableCell>
                            <TableCell className="text-end tabular-nums">{formatMoney((l.unit_cost ?? 0) * l.quantity + (l.expense_amount ?? 0), cur)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => removeLine(l.key)}><X className="size-4" /></Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile cards — large tap targets, easy to type into */}
                  <div className="sm:hidden space-y-3">
                    {lines.length === 0 ? (
                      <div className="border rounded-lg text-center text-muted-foreground py-6 text-sm">
                        {t("purchases.addProductFirst")}
                      </div>
                    ) : lines.map((l) => (
                      <div key={l.key} className="border rounded-lg p-3 space-y-3 bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-sm flex-1 min-w-0 break-words">{l.product_name}</div>
                          <Button variant="ghost" size="icon" className="shrink-0 -mt-1 -me-1" onClick={() => removeLine(l.key)}>
                            <X className="size-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">{t("purchases.unitCost")}</Label>
                            <Input type="number" inputMode="decimal" step="0.01" placeholder="0.00"
                              className="h-11 text-base"
                              value={l.unit_cost ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                updateLine(l.key, { unit_cost: v === "" ? null : (parseFloat(v) || 0) });
                              }} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">{t("purchases.qty")}</Label>
                            <Input type="number" inputMode="numeric" step="1"
                              className="h-11 text-base"
                              value={l.quantity}
                              onChange={(e) => updateLine(l.key, { quantity: parseFloat(e.target.value) || 0 })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">{t("purchases.expenses", { defaultValue: "Expenses" })}</Label>
                            <Input type="number" inputMode="decimal" step="0.01" placeholder="0.00"
                              className="h-11 text-base"
                              value={l.expense_amount ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                updateLine(l.key, { expense_amount: v === "" ? null : (parseFloat(v) || 0) });
                              }} />
                          </div>
                        </div>
                        <div className="flex justify-between text-sm pt-1 border-t">
                          <span className="text-muted-foreground">{t("purchases.lineTotal")}</span>
                          <span className="font-semibold tabular-nums">{formatMoney((l.unit_cost ?? 0) * l.quantity + (l.expense_amount ?? 0), cur)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-end rounded-lg border bg-muted/30 p-3">
                  <div className="space-y-1.5 flex-1">
                    <Label>{t("purchases.sharedExpenses", { defaultValue: "Shared expenses (transport, loading…)" })}</Label>
                    <Input type="number" inputMode="decimal" step="0.01" placeholder="0.00"
                      value={sharedExpense}
                      onChange={(e) => setSharedExpense(e.target.value)} />
                  </div>
                  <Button type="button" variant="outline" onClick={distributeShared}
                    disabled={!(parseFloat(sharedExpense) > 0) || lines.length === 0}>
                    {t("purchases.splitAcrossItems", { defaultValue: "Split across items" })}
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("purchases.paymentMethod")}</Label>
                    <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">{t("pos.cash")}</SelectItem>
                        <SelectItem value="card">{t("pos.card")}</SelectItem>
                        <SelectItem value="mobile">{t("pos.mobile")}</SelectItem>
                        <SelectItem value="other">{t("pos.other")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-0.5 text-sm px-1">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">{t("purchases.goodsSubtotal", { defaultValue: "Goods subtotal" })}</span>
                      <span className="tabular-nums">{formatMoney(subtotal, cur)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">{t("purchases.expenses", { defaultValue: "Expenses" })}</span>
                      <span className="tabular-nums">{formatMoney(expensesTotal, cur)}</span>
                    </div>
                    <div className="flex justify-between gap-4 text-lg font-bold text-primary pt-0.5 border-t">
                      <span>{t("common.total")}</span>
                      <span className="tabular-nums">{formatMoney(subtotal + expensesTotal, cur)}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("common.notes")}</Label>
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("purchases.invoiceImage")} <span className="text-xs text-muted-foreground">({t("common.optional")})</span></Label>
                  {invoiceImageUrl ? (
                    <div className="flex items-center gap-3">
                      <div className="h-20 w-20"><InvoiceImage value={invoiceImageUrl} /></div>
                      <Button type="button" variant="outline" size="sm" onClick={() => setInvoiceImageUrl(null)}>
                        <X className="size-4 mr-1" /> {t("common.remove")}
                      </Button>
                    </div>
                  ) : (
                    <Input type="file" accept="image/*" disabled={uploadingImage}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleInvoiceUpload(f); e.target.value = ""; }} />
                  )}
                  {uploadingImage && <p className="text-xs text-muted-foreground">{t("common.uploading")}…</p>}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
                <Button onClick={save} disabled={busy || lines.length === 0}>{busy ? t("common.saving") : t("common.save")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <PageTip id="purchases.intro" title="Purchases automatically increase stock">
        Record a purchase every time new stock arrives. Each line adds to the product's stock count immediately —
        no need to edit Products afterward. Deleting a purchase reverses the stock change.
      </PageTip>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">

        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total purchases</div>
          <div className="text-lg sm:text-2xl font-bold tabular-nums mt-1 break-words leading-tight">{totalCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total cost</div>
          <div className="text-lg sm:text-2xl font-bold tabular-nums mt-1 break-words leading-tight">{formatMoney(grandTotal, cur)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Outstanding</div>
          <div className="text-lg sm:text-2xl font-bold tabular-nums mt-1 break-words leading-tight">{formatMoney(Math.max(grandTotal - grandPaid, 0), cur)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">paid: {formatMoney(grandPaid, cur)}</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("purchases.searchPlaceholder")}
            aria-label={t("purchases.searchPlaceholder")}
            className="pl-9"
          />
          {search && (
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearch("")}>
              <X className="size-3.5" />
            </Button>
          )}
        </div>

        {debouncedSearch && (
          <div className="mt-4 space-y-3">
            {searching ? (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : !searchResults.length ? (
              <p className="text-sm text-muted-foreground">{t("purchases.noMatches")}</p>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div className="rounded-md border p-2.5">
                    <div className="text-xs text-muted-foreground">{t("purchases.totalPurchased")}</div>
                    <div className="font-bold tabular-nums">{searchSummary?.totalQty}</div>
                  </div>
                  <div className="rounded-md border p-2.5">
                    <div className="text-xs text-muted-foreground">{t("purchases.totalCost")}</div>
                    <div className="font-bold tabular-nums">{formatMoney(searchSummary?.totalCost ?? 0, cur)}</div>
                  </div>
                  <div className="rounded-md border p-2.5">
                    <div className="text-xs text-muted-foreground">{t("purchases.avgCostPerItem")}</div>
                    <div className="font-bold tabular-nums">{formatMoney(searchSummary?.avgCost ?? 0, cur)}</div>
                  </div>
                  <div className="rounded-md border p-2.5">
                    <div className="text-xs text-muted-foreground">{t("purchases.purchaseCount")}</div>
                    <div className="font-bold tabular-nums">{searchSummary?.purchaseCount}</div>
                  </div>
                </div>

                {searchSummary && searchSummary.suppliers.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1.5">{t("purchases.bySupplier")}</div>
                    <div className="border rounded-md divide-y">
                      {searchSummary.suppliers.map((s) => (
                        <div key={s.name} className="flex justify-between items-center p-2 text-sm">
                          <div>
                            <div className="font-medium">{s.name}</div>
                            {s.phone && <div className="text-xs text-muted-foreground">{s.phone}</div>}
                          </div>
                          <div className="text-end">
                            <div className="tabular-nums">{s.qty} × — {formatMoney(s.cost, cur)}</div>
                            <div className="text-xs text-muted-foreground">{t("purchases.avg")}: {formatMoney(s.qty > 0 ? s.cost / s.qty : 0, cur)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1.5">{t("purchases.matchingLines")}</div>
                  <div className="border rounded-md overflow-auto max-h-80">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("common.date")}</TableHead>
                          <TableHead>{t("purchases.referenceShort")}</TableHead>
                          <TableHead>{t("purchases.productCol")}</TableHead>
                          <TableHead>{t("purchases.supplier")}</TableHead>
                          <TableHead className="text-end">{t("purchases.unitCost")}</TableHead>
                          <TableHead className="text-end">{t("purchases.qty")}</TableHead>
                          <TableHead className="text-end">{t("purchases.lineTotal")}</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchResults.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="tabular-nums whitespace-nowrap">{format(new Date(r.purchases.created_at), "MMM d, yyyy")}</TableCell>
                            <TableCell>{r.purchases.reference_number ?? "—"}</TableCell>
                            <TableCell className="font-medium">{r.product_name}</TableCell>
                            <TableCell>{r.purchases.suppliers?.name ?? "—"}</TableCell>
                            <TableCell className="text-end tabular-nums">{formatMoney(Number(r.unit_cost), cur)}</TableCell>
                            <TableCell className="text-end tabular-nums">{Number(r.quantity)}</TableCell>
                            <TableCell className="text-end tabular-nums font-medium">{formatMoney(Number(r.line_total), cur)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => openDetails(r.purchases.id)}><Eye className="size-4" /></Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.date")}</TableHead>
              <TableHead>{t("purchases.referenceShort")}</TableHead>
              <TableHead>{t("purchases.supplier")}</TableHead>
              <TableHead>{t("purchases.payment")}</TableHead>
              <TableHead className="text-end">{t("common.total")}</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("common.loading")}</TableCell></TableRow>
            ) : purchases.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("purchases.empty")}</TableCell></TableRow>
            ) : purchases.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="tabular-nums">{format(new Date(p.created_at), "MMM d, yyyy HH:mm")}</TableCell>
                <TableCell>{p.reference_number ?? "—"}</TableCell>
                <TableCell>{suppliers.find((s) => s.id === p.supplier_id)?.name ?? "—"}</TableCell>
                <TableCell className="capitalize">{p.payment_method}</TableCell>
                <TableCell className="text-end tabular-nums font-medium">{formatMoney(Number(p.total), cur)}</TableCell>
                <TableCell className="text-end whitespace-nowrap">
                  <Button variant="ghost" size="icon" title={t("common.details")} onClick={() => openDetails(p.id)}><Eye className="size-4" /></Button>
                  <Button variant="ghost" size="icon" title="Return to supplier" onClick={() => setSupplierReturnFor(p.id)}><Undo2 className="size-4" /></Button>
                  <Button variant="ghost" size="icon" title={t("common.edit")} onClick={() => startEdit(p.id)}><Edit2 className="size-4" /></Button>
                  {canDelete && (
                    <Button variant="ghost" size="icon" title={t("purchases.deletePurchase")} onClick={() => deletePurchase(p.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalCount}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </Card>

      {details && (
        <DetailsDialog
          open={!!details}
          onClose={() => setDetails(null)}
          title={details.reference_number || t("purchases.purchaseTitle")}
          subtitle={format(new Date(details.created_at), "PPp")}
          rows={[
            { label: t("purchases.supplier"), value: details.suppliers?.name ?? "—" },
            { label: t("purchases.supplierPhone"), value: details.suppliers?.phone ?? "—" },
            { label: t("purchases.paymentMethod"), value: <span className="capitalize">{details.payment_method}</span> },
            { label: t("common.items"), value: details.purchase_items?.length ?? 0 },
            { label: t("common.subtotal"), value: formatMoney(Number(details.subtotal), cur) },
            { label: t("purchases.expenses", { defaultValue: "Expenses" }), value: formatMoney(Number(details.expenses_total ?? 0), cur) },
            { label: t("common.tax"), value: formatMoney(Number(details.tax), cur) },
            { label: t("common.total"), value: <span className="font-bold">{formatMoney(Number(details.total), cur)}</span> },
            { label: t("common.paid"), value: formatMoney(Number(details.paid_amount), cur) },
            {
              label: t("purchases.lineItems"),
              full: true,
              value: (() => {
                const items = (details.purchase_items ?? []) as any[];
                const q = detailsItemSearch.trim().toLowerCase();
                const filtered = q
                  ? items.filter((it) => (it.product_name ?? "").toLowerCase().includes(q))
                  : items;
                return (
                  <div className="space-y-2 mt-1">
                    {items.length > 3 && (
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          value={detailsItemSearch}
                          onChange={(e) => setDetailsItemSearch(e.target.value)}
                          placeholder={t("purchases.searchProducts")}
                          className="h-8 pl-8 text-xs"
                        />
                      </div>
                    )}
                    <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
                      {filtered.length === 0 ? (
                        <div className="p-3 text-xs text-center text-muted-foreground">
                          {t("purchases.noProducts")}
                        </div>
                      ) : filtered.map((it: any) => (
                        <div key={it.id} className="flex justify-between gap-2 p-2 text-xs">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{it.product_name}</div>
                            <div className="text-muted-foreground">
                              {Number(it.quantity)} × {formatMoney(Number(it.unit_cost), cur)} {t("purchases.perItem")}
                              {Number(it.expense_amount ?? 0) > 0 && (
                                <> + {formatMoney(Number(it.expense_amount), cur)} {t("purchases.expensesShort", { defaultValue: "expenses" })}</>
                              )}
                            </div>
                          </div>
                          <span className="tabular-nums font-medium whitespace-nowrap">{formatMoney(Number(it.line_total) + Number(it.expense_amount ?? 0), cur)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })(),
            },
            ...(details.notes ? [{ label: t("common.notes"), value: details.notes, full: true }] : []),
            ...(details.invoice_image_url ? [{
              label: t("purchases.invoiceImage"),
              full: true,
              value: (
                <InvoiceImage value={details.invoice_image_url} />
              ),
            }] : []),
          ]}
          footer={
            <>
              <Button variant="outline" onClick={() => setPrintPurchase(details)}>
                <Printer className="size-4 mr-1" /> {t("common.print", "Print")}
              </Button>
              <Button variant="outline" onClick={() => startEdit(details.id)}>
                <Edit2 className="size-4 mr-1" /> {t("common.edit")}
              </Button>
            </>
          }
        />
      )}

      {printPurchase && (
        <PurchaseReceiptDialog purchase={printPurchase} onClose={() => setPrintPurchase(null)} />
      )}

      {variantPicker && (
        <VariantPickerDialog
          open={!!variantPicker}
          onClose={() => setVariantPicker(null)}
          productName={variantPicker.name}
          basePrice={Number(variantPicker.price)}
          allowOutOfStock
          variants={(variantPicker.variants ?? []).map((v) => ({
            id: v.id, name: v.name, sku: v.sku, barcode: v.barcode,
            price_override: v.price_override, stock: Number(v.stock),
          }))}
          onPick={(v) => {
            const variant = variantPicker.variants?.find((x) => x.id === v.id) ?? null;
            if (variant) pushLine(variantPicker, variant);
          }}
        />
      )}
      <SupplierReturnDialog
        open={!!supplierReturnFor}
        onClose={() => setSupplierReturnFor(null)}
        purchaseId={supplierReturnFor}
        onDone={load}
      />
      {confirmDialog}
    </div>
  );
}
