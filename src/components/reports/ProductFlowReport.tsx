/**
 * Reports → Flow: pick one product and see where it went and came from in the
 * period — which customers bought it, how much and at what price; who it was
 * bought from and at what cost; and what came back.
 *
 * Figures come from the server (`api.productFlow`: a server action on the web,
 * RPC on the terminal). ⚠️ COPIED verbatim to the desktop (minus "use client").
 */

import { searchProducts } from "@/lib/product-search";
import { CatalogFilterBar, useCatalogFilter, useCatalogLists } from "@/components/reports/CatalogFilterBar";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CsvColumn } from "@/lib/csv";
import { formatQty } from "@/lib/format";
import { fmtDate, fmtDateTime } from "@/lib/date-format";
import type { FlowProductOption, FlowPurchaseLine, FlowReturnLine, FlowSaleLine, ProductFlow } from "@/lib/more-reports";
import type { MoreReportProps } from "@/components/reports/MoreReports";

const money2 = (n: number) => n.toFixed(2);
const round2 = (n: number) => Math.round(n * 100) / 100;
const SHOWN = 100;
const NO_SALES: FlowSaleLine[] = [];
const NO_PURCHASES: FlowPurchaseLine[] = [];
const NO_RETURNS: FlowReturnLine[] = [];

interface ByCustomer {
  key: string;
  name: string;
  phone: string | null;
  bills: number;
  quantity: number;
  amount: number;
  avg: number;
  low: number;
  high: number;
  last: string;
}

interface BySupplier {
  key: string;
  name: string;
  purchases: number;
  quantity: number;
  amount: number;
  avg: number;
  last: string;
}

function ProductPicker({ options, value, onChange }: {
  options: FlowProductOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((o) => o.id === value);
  // Filtered here and capped, so a catalogue of thousands stays quick to type into.
  const matches = useMemo(() => {
    // Names by words; barcodes / SKUs only from their start (lib/product-search).
    const hits = searchProducts(options, search);
    return { shown: hits.slice(0, SHOWN), more: Math.max(0, hits.length - SHOWN) };
  }, [options, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="h-9 w-full sm:w-80 justify-between font-normal">
          <span className={selected ? "truncate" : "truncate text-muted-foreground"}>
            {selected ? selected.name : "Search a product…"}
          </span>
          <ChevronsUpDown className="size-4 opacity-50 shrink-0 ms-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-72" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Name, SKU or barcode…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No product matches.</CommandEmpty>
            <CommandGroup>
              {matches.shown.map((o) => (
                <CommandItem key={o.id} value={o.id} onSelect={() => { onChange(o.id); setOpen(false); }}>
                  <Check className={`size-4 me-2 shrink-0 ${value === o.id ? "opacity-100" : "opacity-0"}`} />
                  <span className="truncate">{o.name}</span>
                  {!o.is_active && <span className="ms-2 text-[10px] uppercase text-muted-foreground shrink-0">Archived</span>}
                  {(o.sku || o.variants.length > 0) && (
                    <span className="ms-auto text-xs text-muted-foreground shrink-0 ps-2">
                      {o.variants.length > 0 ? `${o.variants.length} variants` : o.sku}
                    </span>
                  )}
                </CommandItem>
              ))}
              {matches.more > 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">{matches.more} more — keep typing to narrow down.</div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ProductFlowReport({ api, ui, fromDate, toDate, fromISO, toISO, formatMoney, cur }: MoreReportProps) {
  const { KPI, Toolbar, Empty } = ui;
  const [options, setOptions] = useState<FlowProductOption[] | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [productId, setProductId] = useState("");
  const catalog = useCatalogLists(api.catalog);
  const cf = useCatalogFilter(options ?? [], catalog.categories, catalog.brands);
  const pickable = useMemo(() => (options ?? []).filter(cf.match), [options, cf.match]);
  const [variantId, setVariantId] = useState("all");
  const [view, setView] = useState<"customers" | "sales" | "purchases" | "returns">("customers");
  const [state, setState] = useState<{ key: string; data: ProductFlow | null; error: string | null } | null>(null);

  useEffect(() => {
    let live = true;
    api.flowProducts()
      .then((o) => { if (live) setOptions(o); })
      .catch((e) => { if (live) setOptionsError(e instanceof Error ? e.message : "Could not load products."); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const key = productId ? `${productId}|${variantId}|${fromISO}|${toISO}` : "";
  useEffect(() => {
    if (!productId) return;
    let live = true;
    api.productFlow(productId, variantId === "all" ? null : variantId, fromISO, toISO)
      .then((data) => { if (live) setState({ key, data, error: null }); })
      .catch((e) => { if (live) setState({ key, data: null, error: e instanceof Error ? e.message : "Could not load this report." }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const product = options?.find((o) => o.id === productId) ?? null;
  const flow = state?.key === key ? state.data : null;
  const loading = !!productId && state?.key !== key;
  const error = state?.key === key ? state.error : null;
  const sales = flow?.sales ?? NO_SALES;
  const purchases = flow?.purchases ?? NO_PURCHASES;
  const returns = flow?.returns ?? NO_RETURNS;
  const unit = flow?.product.unit || product?.unit || "";
  const showVariant = (product?.variants.length ?? 0) > 0 && variantId === "all";

  const byCustomer = useMemo(() => {
    const map = new Map<string, ByCustomer & { bills_set: Set<string> }>();
    for (const l of sales) {
      const k = l.customer_id ?? "walk-in";
      const c = map.get(k) ?? {
        key: k, name: l.customer_name ?? "Walk-in", phone: l.customer_phone, bills: 0, bills_set: new Set<string>(),
        quantity: 0, amount: 0, avg: 0, low: l.unit_price, high: l.unit_price, last: l.date,
      };
      c.bills_set.add(l.sale_id);
      c.quantity = round2(c.quantity + l.quantity);
      c.amount = round2(c.amount + l.line_total);
      c.low = Math.min(c.low, l.unit_price);
      c.high = Math.max(c.high, l.unit_price);
      if (l.date > c.last) c.last = l.date;
      map.set(k, c);
    }
    return [...map.values()]
      .map(({ bills_set, ...c }) => ({ ...c, bills: bills_set.size, avg: c.quantity ? c.amount / c.quantity : 0 }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [sales]);

  const bySupplier = useMemo(() => {
    const map = new Map<string, BySupplier>();
    for (const l of purchases) {
      const k = l.supplier_name ?? "—";
      const s = map.get(k) ?? { key: k, name: l.supplier_name ?? "No supplier", purchases: 0, quantity: 0, amount: 0, avg: 0, last: l.date };
      s.purchases += 1;
      s.quantity = round2(s.quantity + l.quantity);
      s.amount = round2(s.amount + l.line_total);
      if (l.date > s.last) s.last = l.date;
      map.set(k, s);
    }
    return [...map.values()].map((s) => ({ ...s, avg: s.quantity ? s.amount / s.quantity : 0 })).sort((a, b) => b.quantity - a.quantity);
  }, [purchases]);

  const soldQty = round2(sales.reduce((a, l) => a + l.quantity, 0));
  const soldValue = round2(sales.reduce((a, l) => a + l.line_total, 0));
  const boughtQty = round2(purchases.reduce((a, l) => a + l.quantity, 0));
  const boughtValue = round2(purchases.reduce((a, l) => a + l.line_total, 0));
  const custReturns = returns.filter((r) => r.kind === "customer");
  const suppReturns = returns.filter((r) => r.kind === "supplier");
  const returnedQty = round2(custReturns.reduce((a, l) => a + l.quantity, 0));
  const returnedValue = round2(custReturns.reduce((a, l) => a + l.line_total, 0));
  const sentBackQty = round2(suppReturns.reduce((a, l) => a + l.quantity, 0));
  const prices = sales.map((l) => l.unit_price);
  const q = (n: number) => `${formatQty(n)}${unit ? ` ${unit}` : ""}`;
  const fileTag = `${(product?.name ?? "product").replace(/[^\w]+/g, "_").slice(0, 40)}_${fromDate}_${toDate}`;

  const customerCols: CsvColumn<ByCustomer>[] = [
    { header: "Customer", value: (r) => r.name },
    { header: "Phone", value: (r) => r.phone ?? "" },
    { header: "Bills", value: (r) => r.bills },
    { header: "Quantity", value: (r) => r.quantity },
    { header: "Amount", value: (r) => money2(r.amount) },
    { header: "Average price", value: (r) => money2(r.avg) },
    { header: "Lowest price", value: (r) => money2(r.low) },
    { header: "Highest price", value: (r) => money2(r.high) },
    { header: "Last bought", value: (r) => r.last.slice(0, 10) },
  ];
  const saleCols: CsvColumn<FlowSaleLine>[] = [
    { header: "Date", value: (r) => r.date },
    { header: "Bill", value: (r) => r.receipt_number ?? "" },
    { header: "Customer", value: (r) => r.customer_name ?? "Walk-in" },
    { header: "Phone", value: (r) => r.customer_phone ?? "" },
    { header: "Variant", value: (r) => r.variant_name ?? "" },
    { header: "Quantity", value: (r) => r.quantity },
    { header: "Price", value: (r) => money2(r.unit_price) },
    { header: "Sold as", value: (r) => r.sold_as ?? "" },
    { header: "Amount", value: (r) => money2(r.line_total) },
  ];
  const purchaseCols: CsvColumn<FlowPurchaseLine>[] = [
    { header: "Date", value: (r) => r.date },
    { header: "Reference", value: (r) => r.reference ?? "" },
    { header: "Supplier", value: (r) => r.supplier_name ?? "" },
    { header: "Variant", value: (r) => r.variant_name ?? "" },
    { header: "Quantity", value: (r) => r.quantity },
    { header: "Unit cost", value: (r) => money2(r.unit_cost) },
    { header: "Amount (incl. expenses)", value: (r) => money2(r.line_total) },
  ];
  const returnCols: CsvColumn<FlowReturnLine>[] = [
    { header: "Date", value: (r) => r.date },
    { header: "Type", value: (r) => (r.kind === "customer" ? "From customer" : "To supplier") },
    { header: "Number", value: (r) => r.number ?? "" },
    { header: "Party", value: (r) => r.party_name ?? "" },
    { header: "Variant", value: (r) => r.variant_name ?? "" },
    { header: "Quantity", value: (r) => r.quantity },
    { header: "Price", value: (r) => money2(r.unit_price) },
    { header: "Amount", value: (r) => money2(r.line_total) },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-4 print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 flex-1 min-w-60 sm:flex-none">
            <div className="text-xs text-muted-foreground">Product</div>
            {options ? (
              <ProductPicker options={pickable} value={productId} onChange={(id) => { setProductId(id); setVariantId("all"); }} />
            ) : (
              <div className="h-9 flex items-center text-sm text-muted-foreground">{optionsError ?? "Loading products…"}</div>
            )}
          </div>
          {(cf.options.categories.length > 0 || cf.options.brands.length > 0) && <CatalogFilterBar state={cf} />}
          {product && product.variants.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Variant</div>
              <Select value={variantId} onValueChange={setVariantId}>
                <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All variants</SelectItem>
                  {product.variants.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </Card>

      {!productId ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Search a product above to see which customers bought it, how much and at what price — and who you bought it from.
        </Card>
      ) : loading ? (
        <div className="p-8 text-center text-muted-foreground">Loading…</div>
      ) : error ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{error}</Card>
      ) : (
        <>
          <div className="hidden print:block">
            <h3 className="text-lg font-semibold">Flow — {flow?.product.name}{variantId !== "all" && product ? ` (${product.variants.find((v) => v.id === variantId)?.name ?? ""})` : ""}</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI
              label="Sold"
              value={q(soldQty)}
              sub={`${formatMoney(soldValue, cur)} · ${byCustomer.length} ${byCustomer.length === 1 ? "customer" : "customers"}`}
            />
            <KPI
              label="Average price"
              value={formatMoney(soldQty ? soldValue / soldQty : 0, cur)}
              sub={prices.length ? `${formatMoney(Math.min(...prices), cur)} – ${formatMoney(Math.max(...prices), cur)}` : undefined}
            />
            <KPI
              label="Bought"
              value={q(boughtQty)}
              sub={boughtQty ? `${formatMoney(boughtValue, cur)} · avg ${formatMoney(boughtValue / boughtQty, cur)}` : undefined}
            />
            <KPI
              label="Stock now"
              value={q(flow?.product.stock_now ?? 0)}
              sub={[
                returnedQty ? `${formatQty(returnedQty)} returned by customers` : null,
                sentBackQty ? `${formatQty(sentBackQty)} sent back` : null,
              ].filter(Boolean).join(" · ") || undefined}
            />
          </div>
          {flow?.capped && (
            <p className="text-xs text-amber-600">Only the newest 3,000 lines of each kind are shown — narrow the dates to see the rest.</p>
          )}

          <div className="flex flex-wrap gap-1 print:hidden">
            <Button size="sm" variant={view === "customers" ? "default" : "outline"} onClick={() => setView("customers")}>By customer</Button>
            <Button size="sm" variant={view === "sales" ? "default" : "outline"} onClick={() => setView("sales")}>Every sale ({sales.length})</Button>
            <Button size="sm" variant={view === "purchases" ? "default" : "outline"} onClick={() => setView("purchases")}>Purchases ({purchases.length})</Button>
            <Button size="sm" variant={view === "returns" ? "default" : "outline"} onClick={() => setView("returns")}>Returns ({returns.length})</Button>
          </div>

          {view === "customers" && (
            <Card className="shadow-card p-4">
              <Toolbar title="Bought by customer" rows={byCustomer} columns={customerCols} filename={`flow_customers_${fileTag}`} />
              {byCustomer.length === 0 ? <Empty msg="No one bought this product in this range." /> : (
                <div className="mt-3 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Bills</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Avg price</TableHead>
                        <TableHead className="text-right">Price range</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byCustomer.map((c) => (
                        <TableRow key={c.key}>
                          <TableCell>
                            <div className="font-medium">{c.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {[c.phone, `last bought ${fmtDate(c.last)}`].filter(Boolean).join(" · ")}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{c.bills}</TableCell>
                          <TableCell className="text-right tabular-nums">{q(c.quantity)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(c.avg, cur)}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                            {c.low === c.high ? "—" : `${formatMoney(c.low, cur)} – ${formatMoney(c.high, cur)}`}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">{formatMoney(c.amount, cur)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell className="font-semibold">Total</TableCell>
                        <TableCell className="text-right tabular-nums">{new Set(sales.map((l) => l.sale_id)).size}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{q(soldQty)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(soldQty ? soldValue / soldQty : 0, cur)}</TableCell>
                        <TableCell />
                        <TableCell className="text-right tabular-nums font-bold">{formatMoney(soldValue, cur)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          )}

          {view === "sales" && (
            <Card className="shadow-card p-4">
              <Toolbar title="Every sale of this product" rows={sales} columns={saleCols} filename={`flow_sales_${fileTag}`} />
              {sales.length === 0 ? <Empty msg="Not sold in this range." /> : (
                <div className="mt-3 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Bill</TableHead>
                        <TableHead>Customer</TableHead>
                        {showVariant && <TableHead>Variant</TableHead>}
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="whitespace-nowrap text-xs">{fmtDateTime(l.date)}</TableCell>
                          <TableCell className="font-mono text-xs">{l.receipt_number ?? "—"}</TableCell>
                          <TableCell>
                            <div>{l.customer_name ?? <span className="text-muted-foreground">Walk-in</span>}</div>
                            {l.customer_phone && <div className="text-xs text-muted-foreground">{l.customer_phone}</div>}
                          </TableCell>
                          {showVariant && <TableCell className="text-xs">{l.variant_name ?? "—"}</TableCell>}
                          <TableCell className="text-right tabular-nums">
                            {q(l.quantity)}
                            {l.sold_as && <div className="text-xs text-muted-foreground">{l.sold_as}</div>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(l.unit_price, cur)}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{formatMoney(l.line_total, cur)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          )}

          {view === "purchases" && (
            <Card className="shadow-card p-4 space-y-4">
              <Toolbar title="Bought from" rows={purchases} columns={purchaseCols} filename={`flow_purchases_${fileTag}`} />
              {purchases.length === 0 ? <Empty msg="Not purchased in this range." /> : (
                <>
                  {bySupplier.length > 1 && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Supplier</TableHead>
                            <TableHead className="text-right">Purchases</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Avg cost</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bySupplier.map((s) => (
                            <TableRow key={s.key}>
                              <TableCell>
                                <div className="font-medium">{s.name}</div>
                                <div className="text-xs text-muted-foreground">last bought {fmtDate(s.last)}</div>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{s.purchases}</TableCell>
                              <TableCell className="text-right tabular-nums">{q(s.quantity)}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatMoney(s.avg, cur)}</TableCell>
                              <TableCell className="text-right tabular-nums font-semibold">{formatMoney(s.amount, cur)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Supplier</TableHead>
                          {showVariant && <TableHead>Variant</TableHead>}
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Unit cost</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchases.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell className="whitespace-nowrap text-xs">{fmtDate(l.date)}</TableCell>
                            <TableCell className="font-mono text-xs">{l.reference ?? "—"}</TableCell>
                            <TableCell>{l.supplier_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                            {showVariant && <TableCell className="text-xs">{l.variant_name ?? "—"}</TableCell>}
                            <TableCell className="text-right tabular-nums">{q(l.quantity)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(l.unit_cost, cur)}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">{formatMoney(l.line_total, cur)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={showVariant ? 4 : 3} className="font-semibold">Total</TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">{q(boughtQty)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(boughtQty ? boughtValue / boughtQty : 0, cur)}</TableCell>
                          <TableCell className="text-right tabular-nums font-bold">{formatMoney(boughtValue, cur)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </Card>
          )}

          {view === "returns" && (
            <Card className="shadow-card p-4">
              <Toolbar title="Returns of this product" rows={returns} columns={returnCols} filename={`flow_returns_${fileTag}`} />
              {returns.length === 0 ? <Empty msg="No returns of this product in this range." /> : (
                <div className="mt-3 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Number</TableHead>
                        <TableHead>Party</TableHead>
                        {showVariant && <TableHead>Variant</TableHead>}
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returns.map((l) => (
                        <TableRow key={`${l.kind}-${l.id}`}>
                          <TableCell className="whitespace-nowrap text-xs">{fmtDate(l.date)}</TableCell>
                          <TableCell className="text-xs">{l.kind === "customer" ? "From customer" : "To supplier"}</TableCell>
                          <TableCell className="font-mono text-xs">{l.number ?? "—"}</TableCell>
                          <TableCell>{l.party_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                          {showVariant && <TableCell className="text-xs">{l.variant_name ?? "—"}</TableCell>}
                          <TableCell className="text-right tabular-nums">{q(l.quantity)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(l.unit_price, cur)}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{formatMoney(l.line_total, cur)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {returnedValue > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Customers returned {q(returnedQty)} worth {formatMoney(returnedValue, cur)} — not taken off the sales above.
                </p>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
