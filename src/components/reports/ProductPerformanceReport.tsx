/**
 * Reports → Products: best and worst sellers, by quantity, sales value and
 * profit — for the whole shop, or inside the chosen category / brand. The
 * maths is lib/product-performance; each host only supplies the rows.
 *
 * ⚠️ COPIED verbatim to the desktop (minus "use client") — change both.
 */

import { useMemo, useState, type ComponentType } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CsvColumn } from "@/lib/csv";
import { formatQty } from "@/lib/format";
import type { MovementRow } from "@/lib/product-movement";
import type { CatalogBrand, CatalogCategory } from "@/lib/sales-report";
import {
  PERF_SORTS,
  performanceTotals,
  productPerformance,
  rankPerformance,
  type PerfGroup,
  type PerfRow,
  type PerfSort,
} from "@/lib/product-performance";
import { CatalogFilterBar, useCatalogFilter } from "@/components/reports/CatalogFilterBar";
import { Segmented } from "@/components/reports/SalesReportView";

export interface ProductPerformanceUi {
  KPI: ComponentType<{ label: string; value: string; sub?: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Toolbar: ComponentType<{ title: string; rows: any[]; columns: CsvColumn<any>[]; filename: string }>;
  Empty: ComponentType<{ msg: string }>;
}

export interface ProductPerformanceProps {
  rows: MovementRow[];
  /** Average landed cost per unit, keyed by variant id else product id (lib/pnl). */
  costs: Map<string, number> | Record<string, number>;
  categories: CatalogCategory[];
  brands: CatalogBrand[];
  ui: ProductPerformanceUi;
  fromDate: string;
  toDate: string;
  formatMoney: (n: number, cur?: string) => string;
  cur: string;
}

const LIMITS = [
  { value: "10", label: "Top 10" },
  { value: "25", label: "Top 25" },
  { value: "50", label: "Top 50" },
  { value: "all", label: "All" },
];

export function ProductPerformanceReport({ rows, costs, categories, brands, ui, fromDate, toDate, formatMoney, cur }: ProductPerformanceProps) {
  const { KPI, Toolbar, Empty } = ui;
  const catalog = useCatalogFilter(rows, categories, brands);
  const [group, setGroup] = useState<PerfGroup>("product");
  const [sort, setSort] = useState<PerfSort>("most_qty");
  const [limit, setLimit] = useState("25");
  const [search, setSearch] = useState("");

  const inScope = useMemo(() => rows.filter((r) => catalog.match(r)), [rows, catalog.match]);
  const productRows = useMemo(() => productPerformance(inScope, costs, categories, brands, "product"), [inScope, costs, categories, brands]);
  const totals = useMemo(() => performanceTotals(productRows), [productRows]);

  const ranked = useMemo(() => {
    const grouped = group === "product" ? productRows : productPerformance(inScope, costs, categories, brands, group);
    const needle = search.trim().toLowerCase();
    const list = rankPerformance(grouped, sort).filter(
      (r) => !needle || r.name.toLowerCase().includes(needle) || (r.sku ?? "").toLowerCase().includes(needle),
    );
    return limit === "all" ? list : list.slice(0, Number(limit));
  }, [group, productRows, inScope, costs, categories, brands, sort, search, limit]);

  const groupLabel = group === "product" ? "Product" : group === "category" ? "Category" : "Brand";
  const sortLabel = PERF_SORTS.find((s) => s.value === sort)?.label ?? "";
  const scope = catalog.filtered ? catalog.label : "All products";
  const best = rankPerformance(productRows, "most_qty")[0];
  const topProfit = rankPerformance(productRows, "most_profit")[0];
  const qty = (n: number, unit?: string | null) => `${formatQty(n)}${unit ? ` ${unit}` : ""}`;
  const money = (n: number | null) => (n === null ? "—" : formatMoney(n, cur));
  const maxShare = Math.max(1, ...ranked.map((r) => r.share));

  const columns: CsvColumn<PerfRow>[] = [
    { header: "#", value: (r) => String(ranked.indexOf(r) + 1) },
    { header: groupLabel, value: (r) => r.name },
    ...(group === "product"
      ? [
          { header: "SKU", value: (r: PerfRow) => r.sku ?? "" },
          { header: "Category", value: (r: PerfRow) => r.category },
          { header: "Brand", value: (r: PerfRow) => r.brand },
        ]
      : [{ header: "Products", value: (r: PerfRow) => String(r.products) }]),
    { header: "Sold (net)", value: (r) => String(r.sold) },
    { header: "Returned", value: (r) => String(r.returned) },
    { header: "Sales value", value: (r) => r.sales_value.toFixed(2) },
    { header: "Cost", value: (r) => (r.cost === null ? "" : r.cost.toFixed(2)) },
    { header: "Profit", value: (r) => (r.profit === null ? "" : r.profit.toFixed(2)) },
    { header: "Margin %", value: (r) => (r.margin === null ? "" : r.margin.toFixed(1)) },
    { header: "Share %", value: (r) => r.share.toFixed(1) },
    { header: "Left now", value: (r) => (r.left === null ? "" : String(r.left)) },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-3 shadow-card flex flex-wrap items-end gap-3 print:hidden">
        <CatalogFilterBar state={catalog} />
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <Segmented<PerfGroup>
            value={group}
            onChange={setGroup}
            options={[{ value: "product", label: "Product" }, { value: "category", label: "Category" }, { value: "brand", label: "Brand" }]}
          />
        </div>
      </Card>
      <p className="hidden print:block text-sm">{scope} · {sortLabel}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Units sold" value={formatQty(totals.units)} sub={`${totals.products_selling} products sold · ${totals.products_idle} not selling`} />
        <KPI label="Sales value" value={formatMoney(totals.sales_value, cur)} sub="net of returns, before bill discounts" />
        <KPI
          label="Gross profit"
          value={formatMoney(totals.profit, cur)}
          sub={totals.margin === null ? undefined : `${totals.margin.toFixed(1)}% margin`}
        />
        <KPI
          label="Best seller"
          value={best ? best.name : "—"}
          sub={best ? `${qty(best.sold, best.unit)} sold${topProfit && topProfit.key !== best.key ? ` · most profit: ${topProfit.name}` : ""}` : undefined}
        />
      </div>

      <Card className="shadow-card p-4">
        <Toolbar
          title={`${sortLabel} — ${scope}`}
          rows={ranked}
          columns={columns}
          filename={`products_${sort}_${fromDate}_${toDate}${catalog.filtered ? "_filtered" : ""}`}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
          <Select value={sort} onValueChange={(v) => setSort(v as PerfSort)}>
            <SelectTrigger className="h-9 w-full sm:w-56" aria-label="Rank by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERF_SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={limit} onValueChange={setLimit}>
            <SelectTrigger className="h-9 w-28" aria-label="How many">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIMITS.map((l) => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${groupLabel.toLowerCase()}…`}
            className="h-9 w-full sm:w-60"
          />
        </div>

        {ranked.length === 0 ? (
          <Empty msg={sort === "not_selling" ? "Everything in stock sold at least once in this period." : "Nothing sold in this period."} />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>{groupLabel}</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">Sales value</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="min-w-[120px]">Share</TableHead>
                  <TableHead className="text-right">Left now</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((r, i) => (
                  <TableRow key={r.key}>
                    <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                        {group === "product" ? (
                          <>
                            {r.sku && <span className="font-mono">{r.sku}</span>}
                            <span>{r.category}</span>
                            <span>{r.brand}</span>
                          </>
                        ) : (
                          <span>{r.products} product{r.products === 1 ? "" : "s"}</span>
                        )}
                        {r.uncosted > 0 && <Badge variant="outline" className="h-4 px-1 text-[10px]">cost unknown</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {r.sold ? qty(r.sold, r.unit) : "—"}
                      {r.returned > 0 && <div className="text-xs font-normal text-muted-foreground">{formatQty(r.returned)} returned</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.sales_value ? formatMoney(r.sales_value, cur) : "—"}</TableCell>
                    <TableCell className={`text-right tabular-nums ${r.profit !== null && r.profit < 0 ? "text-destructive font-semibold" : ""}`}>
                      {money(r.profit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.margin === null ? "—" : `${r.margin.toFixed(1)}%`}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${(r.share / maxShare) * 100}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{r.share.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${r.left !== null && r.left <= 0 ? "text-destructive" : ""}`}>
                      {r.left === null ? "—" : qty(r.left, r.unit)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Sold is net of returns; sales value is what those lines were billed at less refunds, before bill discounts.
          Profit uses each product&apos;s average purchase cost — the same basis as the Profit &amp; Loss report.
          {totals.uncosted > 0 && ` ${formatQty(totals.uncosted)} units sold were never bought through the app, so their cost is unknown and left out of profit.`}
          {" "}Picking a category includes its sub-categories.
        </p>
      </Card>
    </div>
  );
}
