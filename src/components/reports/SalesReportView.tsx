/**
 * Reports → Sales: filters (category, brand, product), the tiles, and either
 * the bills or a ranking of what sold (most / least, by product, category or
 * brand). Each host supplies the rows and its own KPI / toolbar / empty pieces.
 *
 * ⚠️ COPIED verbatim to the desktop (minus "use client") — change both.
 */

import { useMemo, useState, type ComponentType } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { format } from "date-fns";
import type { CsvColumn } from "@/lib/csv";
import { formatQty } from "@/lib/format";
import { fmtDateTime } from "@/lib/date-format";
import {
  filterOptions,
  filterSales,
  isFiltered,
  lineMatcher,
  rankSales,
  RANK_SORTS,
  type CatalogBrand,
  type CatalogCategory,
  type FilterOption,
  type GroupBy,
  type RankRow,
  type RankSort,
  type SalesFilter,
  type SalesReportBill,
} from "@/lib/sales-report";

export interface SalesReportUi {
  KPI: ComponentType<{ label: string; value: string; sub?: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Toolbar: ComponentType<{ title: string; rows: any[]; columns: CsvColumn<any>[]; filename: string }>;
  Empty: ComponentType<{ msg: string }>;
}

export interface SalesReportPayment { account_name: string; amount: number }

export interface SalesReportRow extends SalesReportBill {
  receipt_number: string | null;
  created_at: string;
  payment_method: string;
  payments?: SalesReportPayment[];
  balance_due?: number;
  customers: { name: string } | null;
}

export interface SalesReportViewProps {
  rows: SalesReportRow[];
  categories: CatalogCategory[];
  brands: CatalogBrand[];
  ui: SalesReportUi;
  /** yyyy-mm-dd, for file names. */
  fromDate: string;
  toDate: string;
  formatMoney: (n: number | string, c?: string) => string;
  cur: string;
}

const EMPTY: SalesFilter = { category: "", brand: "", product: "" };

/** A searchable dropdown; "" means every one. */
function FilterPicker({ label, all, value, options, onChange }: {
  label: string; all: string; value: string; options: FilterOption[]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const chosen = options.find((o) => o.value === value);
  return (
    // A <div>, not a <label>: a label re-clicks the button inside it, so the
    // popover opened and shut again on a single click.
    <div className="text-xs text-muted-foreground flex flex-col gap-1 min-w-0">
      {label}
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="h-9 w-[200px] justify-between font-normal">
              <span className={`truncate ${chosen ? "" : "text-muted-foreground"}`}>{chosen?.label ?? all}</span>
              <ChevronsUpDown className="size-3.5 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[260px]" align="start">
            <Command>
              <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
              <CommandList>
                <CommandEmpty>Nothing found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem value={`__all__ ${all}`} onSelect={() => { onChange(""); setOpen(false); }}>
                    <Check className={`size-3.5 mr-2 ${value === "" ? "opacity-100" : "opacity-0"}`} />{all}
                  </CommandItem>
                  {options.map((o) => (
                    <CommandItem key={o.value} value={`${o.label} ${o.value}`} onSelect={() => { onChange(o.value); setOpen(false); }}>
                      <Check className={`size-3.5 mr-2 shrink-0 ${value === o.value ? "opacity-100" : "opacity-0"}`} />
                      <span style={{ paddingLeft: (o.depth ?? 0) * 12 }} className="truncate">{o.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {value && (
          <Button size="icon" variant="ghost" className="size-8" onClick={() => onChange("")} aria-label={`Clear ${label}`}>
            <X className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg">
      {options.map((o) => (
        <Button key={o.value} size="sm" variant={value === o.value ? "secondary" : "ghost"} onClick={() => onChange(o.value)} className={`h-7 px-2.5 text-xs ${value === o.value ? "bg-background shadow-sm" : ""}`}>
          {o.label}
        </Button>
      ))}
    </div>
  );
}

const lineText = (l: { product_name: string; quantity: number }, times: string) =>
  Number(l.quantity) !== 1 ? `${l.product_name} ${times}${formatQty(Number(l.quantity))}` : l.product_name;

export function SalesReportView({ rows, categories, brands, ui, fromDate, toDate, formatMoney, cur }: SalesReportViewProps) {
  const { KPI, Toolbar, Empty } = ui;
  const [filter, setFilter] = useState<SalesFilter>(EMPTY);
  const [view, setView] = useState<"bills" | "ranking">("bills");
  const [groupBy, setGroupBy] = useState<GroupBy>("product");
  const [sort, setSort] = useState<RankSort>("most_qty");

  const options = useMemo(() => filterOptions(rows, categories, brands), [rows, categories, brands]);
  const { bills, stats } = useMemo(() => filterSales(rows, filter, categories, brands), [rows, filter, categories, brands]);
  const ranking = useMemo(() => rankSales(rows, filter, categories, brands, groupBy, sort), [rows, filter, categories, brands, groupBy, sort]);
  const match = useMemo(() => lineMatcher(filter, categories, brands), [filter, categories, brands]);
  const filtered = isFiltered(filter);

  const billColumns: CsvColumn<SalesReportRow>[] = [
    { header: "Date", value: (r) => format(new Date(r.created_at), "yyyy-MM-dd HH:mm") },
    { header: "Receipt", value: (r) => r.receipt_number ?? r.id.slice(0, 8) },
    { header: "Products", value: (r) => r.sale_items.filter(match).map((l) => lineText(l, "x")).join("; ") },
    { header: "Customer", value: (r) => r.customers?.name ?? "Walk-in" },
    { header: "Payment", value: (r) => (r.payments?.length ? r.payments.map((p) => `${p.account_name} ${p.amount}`).join(" | ") : r.payment_method) },
    { header: "Balance due", value: (r) => ((r.balance_due ?? 0) > 0 ? r.balance_due!.toFixed(2) : "") },
    ...(filtered ? [{ header: "Matching lines", value: (r: SalesReportRow) => r.sale_items.filter(match).reduce((a, l) => a + Number(l.line_total), 0).toFixed(2) }] : []),
    { header: "Subtotal", value: (r) => Number(r.subtotal).toFixed(2) },
    { header: "Discount", value: (r) => Number(r.discount).toFixed(2) },
    { header: "Tax", value: (r) => Number(r.tax).toFixed(2) },
    { header: "Total", value: (r) => Number(r.total).toFixed(2) },
  ];
  const groupLabel = groupBy === "product" ? "Product" : groupBy === "category" ? "Category" : "Brand";
  const rankColumns: CsvColumn<RankRow>[] = [
    { header: "#", value: (_r) => String(ranking.indexOf(_r) + 1) },
    { header: groupLabel, value: (r) => r.name },
    ...(groupBy === "product" ? [
      { header: "Category", value: (r: RankRow) => r.category },
      { header: "Brand", value: (r: RankRow) => r.brand },
    ] : []),
    { header: "Quantity sold", value: (r) => String(r.quantity) },
    { header: "Bills", value: (r) => String(r.bills) },
    { header: "Sales value", value: (r) => r.revenue.toFixed(2) },
    { header: "Share %", value: (r) => r.share.toFixed(1) },
  ];

  const set = (patch: Partial<SalesFilter>) => setFilter((f) => ({ ...f, ...patch }));
  const filterNote = [
    filter.category && options.categories.find((o) => o.value === filter.category)?.label,
    filter.brand && options.brands.find((o) => o.value === filter.brand)?.label,
    filter.product && options.products.find((o) => o.value === filter.product)?.label,
  ].filter(Boolean).join(" · ");
  const slug = [fromDate, toDate, filtered ? "filtered" : ""].filter(Boolean).join("_");

  return (
    <div className="space-y-4">
      <Card className="p-3 shadow-card flex flex-wrap items-end gap-3 print:hidden">
        <FilterPicker label="Category" all="All categories" value={filter.category} options={options.categories} onChange={(category) => set({ category })} />
        <FilterPicker label="Brand" all="All brands" value={filter.brand} options={options.brands} onChange={(brand) => set({ brand })} />
        <FilterPicker label="Product" all="All products" value={filter.product} options={options.products} onChange={(product) => set({ product })} />
        {filtered && <Button size="sm" variant="ghost" className="h-9" onClick={() => setFilter(EMPTY)}>Clear filters</Button>}
        <div className="ml-auto">
          <Segmented value={view} onChange={setView} options={[{ value: "bills", label: "Bills" }, { value: "ranking", label: "Most / least sold" }]} />
        </div>
      </Card>
      {filtered && <p className="hidden print:block text-sm">Filtered: {filterNote}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI
          label={filtered ? "Sales of selection" : "Revenue"}
          value={formatMoney(stats.revenue, cur)}
          sub={filtered ? `In ${stats.bills} bills · before bill discounts` : `${stats.bills} bills`}
        />
        <KPI
          label="Average bill"
          value={formatMoney(stats.average, cur)}
          sub={filtered ? `Selection ÷ ${stats.bills} bills` : `Revenue ÷ ${stats.bills} bills`}
        />
        <KPI label="Items sold" value={formatQty(stats.items)} />
        <KPI label="Tax collected" value={formatMoney(stats.tax, cur)} sub={`Discounts ${formatMoney(stats.discount, cur)}`} />
      </div>

      {view === "bills" ? (
        <Card className="shadow-card p-4">
          <Toolbar title={filtered ? `Sales detail — ${filterNote}` : "Sales detail"} rows={bills} columns={billColumns} filename={`sales_${slug}`} />
          {bills.length === 0 ? <Empty msg={filtered ? "No sales of this selection in this range." : "No sales in this range."} /> : (
            <div className="mt-3 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Receipt</TableHead><TableHead>Products</TableHead><TableHead>Customer</TableHead><TableHead>Payment</TableHead>
                    {filtered && <TableHead className="text-right">Matching</TableHead>}
                    <TableHead className="text-right">Subtotal</TableHead><TableHead className="text-right">Tax</TableHead><TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bills.map((r) => {
                    const hits = r.sale_items.filter(match);
                    const others = r.sale_items.length - hits.length;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(r.created_at)}</TableCell>
                        <TableCell className="font-mono text-xs">{r.receipt_number ?? r.id.slice(0, 8)}</TableCell>
                        <TableCell className="max-w-[18rem] text-sm">
                          <div className="truncate">{hits.map((l) => lineText(l, "×")).join(", ") || "—"}</div>
                          {filtered && others > 0 && <div className="text-[11px] text-muted-foreground">+{others} other item{others === 1 ? "" : "s"} on the bill</div>}
                        </TableCell>
                        <TableCell>{r.customers?.name ?? "Walk-in"}</TableCell>
                        <TableCell>
                          {r.payments?.length ? (
                            <div className="space-y-0.5">
                              {r.payments.map((p, i) => (
                                <div key={i} className="text-xs whitespace-nowrap">
                                  {p.account_name} <span className="tabular-nums">{formatMoney(p.amount, cur)}</span>
                                </div>
                              ))}
                              {(r.balance_due ?? 0) > 0 && (
                                <div className="text-xs text-warning font-medium whitespace-nowrap">{formatMoney(r.balance_due!, cur)} due</div>
                              )}
                            </div>
                          ) : (
                            <span className="capitalize">{r.payment_method}</span>
                          )}
                        </TableCell>
                        {filtered && <TableCell className="text-right tabular-nums">{formatMoney(hits.reduce((a, l) => a + Number(l.line_total), 0), cur)}</TableCell>}
                        <TableCell className="text-right tabular-nums">{formatMoney(r.subtotal, cur)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(r.tax, cur)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{formatMoney(r.total, cur)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      ) : (
        <Card className="shadow-card p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <span className="text-xs text-muted-foreground">Group by</span>
            <Segmented value={groupBy} onChange={setGroupBy} options={[{ value: "product", label: "Product" }, { value: "category", label: "Category" }, { value: "brand", label: "Brand" }]} />
            <span className="text-xs text-muted-foreground ml-2">Sort</span>
            <Segmented value={sort} onChange={setSort} options={RANK_SORTS.map((s) => ({ value: s.value, label: s.label.replace(" (quantity)", "") }))} />
          </div>
          <Toolbar
            title={`${RANK_SORTS.find((s) => s.value === sort)!.label} — by ${groupLabel.toLowerCase()}${filtered ? ` · ${filterNote}` : ""}`}
            rows={ranking}
            columns={rankColumns}
            filename={`sales_by_${groupBy}_${slug}`}
          />
          {ranking.length === 0 ? <Empty msg="Nothing sold in this range." /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>{groupLabel}</TableHead>
                    {groupBy === "product" && <><TableHead>Category</TableHead><TableHead>Brand</TableHead></>}
                    <TableHead className="text-right">Qty sold</TableHead>
                    <TableHead className="text-right">Bills</TableHead>
                    <TableHead className="text-right">Sales value</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((r, i) => (
                    <TableRow key={r.key}>
                      <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      {groupBy === "product" && <><TableCell className="text-sm whitespace-nowrap">{r.category}</TableCell><TableCell className="text-sm whitespace-nowrap">{r.brand}</TableCell></>}
                      <TableCell className="text-right tabular-nums font-semibold">{formatQty(r.quantity)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.bills}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(r.revenue, cur)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{r.share.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Only products sold at least once in this range are listed. Sales value is the line totals, before discounts given on the whole bill.
            For products that didn&apos;t sell at all, use Sold &amp; left → Not selling.
          </p>
        </Card>
      )}
    </div>
  );
}
