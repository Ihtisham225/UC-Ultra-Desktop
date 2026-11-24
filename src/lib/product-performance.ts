/**
 * Reports → Products: which products sell best (or worst), by quantity, by
 * money and by profit — for the whole shop or inside one category / brand.
 *
 * Built on the Sold & left rows (lib/product-movement), so the two reports
 * count the same units and the same sales value: net of returns, before bill
 * discounts. Cost is the product's average landed cost (lib/pnl — the P&L's
 * own basis), so a product's profit here adds up with the P&L's gross profit
 * for the same lines.
 *
 * Pure. ⚠️ COPIED verbatim to the desktop — change both.
 */

import type { MovementRow } from "./product-movement";
import { catalogKeys, catalogNames, type CatalogBrand, type CatalogCategory } from "./sales-report";

export type PerfGroup = "product" | "category" | "brand";
export type PerfSort =
  | "most_qty"
  | "most_value"
  | "most_profit"
  | "best_margin"
  | "least_qty"
  | "least_profit"
  | "not_selling";

export const PERF_SORTS: { value: PerfSort; label: string }[] = [
  { value: "most_qty", label: "Best sellers (quantity)" },
  { value: "most_value", label: "Highest sales value" },
  { value: "most_profit", label: "Most profit" },
  { value: "best_margin", label: "Best margin %" },
  { value: "least_qty", label: "Slowest sellers" },
  { value: "least_profit", label: "Least profit / loss" },
  { value: "not_selling", label: "Not selling (in stock)" },
];

export interface PerfRow {
  key: string;
  name: string;
  sku: string | null;
  unit: string | null;
  category: string;
  brand: string;
  /** Products rolled into a category / brand row (1 for a product row). */
  products: number;
  /** Net of returns, in each product's base unit. */
  sold: number;
  returned: number;
  /** Line totals less refunds, before bill discounts. */
  sales_value: number;
  /** sold × average landed cost; null when nothing sold had a known cost. */
  cost: number | null;
  /** sales_value − cost; null with cost. */
  profit: number | null;
  /** profit ÷ sales value, 0–100. */
  margin: number | null;
  /** Sold units whose product was never bought through the app (cost unknown). */
  uncosted: number;
  /** Stock now; null for a service. */
  left: number | null;
  /** Share of all ranked rows' sales value, 0–100. */
  share: number;
  is_service: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const q3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * One row per product (variant), category or brand. `costs` is the average
 * landed cost per unit keyed by variant id, else product id — what
 * lib/pnl::averageCostsWithRecipes returns.
 */
export function productPerformance(
  rows: MovementRow[],
  costs: Map<string, number> | Record<string, number>,
  categories: CatalogCategory[],
  brands: CatalogBrand[],
  group: PerfGroup,
): PerfRow[] {
  const costOf = (k: string | null) => {
    if (!k) return undefined;
    return costs instanceof Map ? costs.get(k) : costs[k];
  };
  const names = catalogNames(categories, brands);
  const out = new Map<string, PerfRow & { costed: number }>();

  for (const r of rows) {
    const key =
      group === "product" ? r.key : group === "category" ? catalogKeys.category(r) : catalogKeys.brand(r);
    let row = out.get(key);
    if (!row) {
      const category = names.category(r);
      const brand = names.brand(r);
      row = {
        key,
        name: group === "product" ? r.name : group === "category" ? category : brand,
        sku: group === "product" ? r.sku : null,
        unit: group === "product" ? r.unit : null,
        category,
        brand,
        products: 0,
        sold: 0,
        returned: 0,
        sales_value: 0,
        cost: 0,
        profit: null,
        margin: null,
        uncosted: 0,
        left: group === "product" ? r.left : null,
        share: 0,
        is_service: r.is_service,
        costed: 0,
      };
      out.set(key, row);
    }
    row.products += 1;
    row.sold += r.net_sold;
    row.returned += r.returned;
    row.sales_value += r.sales_value;
    if (group !== "product" && r.left !== null) row.left = (row.left ?? 0) + Math.max(0, r.left);
    if (r.net_sold !== 0) {
      const unitCost = costOf(r.variant_id) ?? costOf(r.product_id);
      if (unitCost === undefined) row.uncosted += r.net_sold;
      else {
        row.cost = (row.cost ?? 0) + r.net_sold * unitCost;
        row.costed += 1;
      }
    }
    if (!r.is_service) row.is_service = false;
  }

  const total = [...out.values()].reduce((a, r) => a + Math.max(0, r.sales_value), 0);
  return [...out.values()].map(({ costed, ...r }) => {
    const hasCost = costed > 0;
    const cost = hasCost ? r2(r.cost ?? 0) : null;
    const value = r2(r.sales_value);
    const profit = cost === null ? null : r2(value - cost);
    return {
      ...r,
      sold: q3(r.sold),
      returned: q3(r.returned),
      sales_value: value,
      cost,
      profit,
      margin: profit === null || value <= 0 ? null : (profit / value) * 100,
      uncosted: q3(r.uncosted),
      left: r.left === null ? null : q3(r.left),
      share: total > 0 ? (Math.max(0, value) / total) * 100 : 0,
    };
  });
}

/** In stock, and nothing sold or came back in the period. */
export const isIdle = (r: PerfRow) => !r.is_service && r.sold === 0 && r.returned === 0 && (r.left ?? 0) > 0;

/**
 * Sorted for the chosen ranking. "Slowest" lists only things that sold at
 * least once — what never sold is "Not selling", which lists only those.
 */
export function rankPerformance(rows: PerfRow[], sort: PerfSort): PerfRow[] {
  const sold = (r: PerfRow) => r.sold > 0 || r.sales_value !== 0;
  const byName = (a: PerfRow, b: PerfRow) => a.name.localeCompare(b.name);
  const p = (r: PerfRow) => r.profit ?? Number.NEGATIVE_INFINITY;
  switch (sort) {
    case "most_qty":
      return rows.filter(sold).sort((a, b) => b.sold - a.sold || b.sales_value - a.sales_value || byName(a, b));
    case "most_value":
      return rows.filter(sold).sort((a, b) => b.sales_value - a.sales_value || b.sold - a.sold || byName(a, b));
    case "most_profit":
      return rows.filter((r) => sold(r) && r.profit !== null).sort((a, b) => p(b) - p(a) || byName(a, b));
    case "best_margin":
      return rows.filter((r) => sold(r) && r.margin !== null).sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0) || byName(a, b));
    case "least_qty":
      return rows.filter(sold).sort((a, b) => a.sold - b.sold || a.sales_value - b.sales_value || byName(a, b));
    case "least_profit":
      return rows.filter((r) => sold(r) && r.profit !== null).sort((a, b) => p(a) - p(b) || byName(a, b));
    case "not_selling":
      return rows.filter(isIdle).sort((a, b) => (b.left ?? 0) - (a.left ?? 0) || byName(a, b));
  }
}

export function performanceTotals(rows: PerfRow[]) {
  let sold = 0, value = 0, cost = 0, profit = 0, uncosted = 0, selling = 0, idle = 0;
  for (const r of rows) {
    sold += r.sold;
    value += r.sales_value;
    if (r.cost !== null) cost += r.cost;
    if (r.profit !== null) profit += r.profit;
    uncosted += r.uncosted;
    if (r.sold > 0) selling += r.products;
    if (isIdle(r)) idle += r.products;
  }
  return {
    units: q3(sold),
    sales_value: r2(value),
    cost: r2(cost),
    profit: r2(profit),
    margin: value > 0 ? (profit / value) * 100 : null,
    uncosted: q3(uncosted),
    products_selling: selling,
    products_idle: idle,
  };
}
