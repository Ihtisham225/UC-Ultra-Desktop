/**
 * Reports → Sales: narrowing the bills to a category, a brand or one product,
 * and ranking what sold (most / least, by quantity or by money).
 *
 * Pure — the web feeds it the sales report action's rows, the terminal its
 * offline store — so both apps filter and rank the same way.
 *
 * ⚠️ COPIED verbatim to the desktop — change both.
 */

export interface SalesReportLine {
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  /** Always in the product's base unit (see sale_items.unit_factor). */
  quantity: number;
  line_total: number;
  /** The product's category / brand, as the product reads NOW. */
  category_id?: string | null;
  category?: string | null;
  brand_id?: string | null;
  brand?: string | null;
}

export interface SalesReportBill {
  id: string;
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
  sale_items: SalesReportLine[];
}

export interface CatalogCategory { id: string; name: string; parent_id: string | null }
export interface CatalogBrand { id: string; name: string }

/** "" = no filter; NONE = lines with no category / brand. */
export const NONE = "__none__";

export interface SalesFilter {
  category: string;
  brand: string;
  /** A ranking key (see `lineKey`), or "" for every product. */
  product: string;
}

export type GroupBy = "product" | "category" | "brand";
export type RankSort = "most_qty" | "least_qty" | "most_revenue" | "least_revenue";

export const RANK_SORTS: { value: RankSort; label: string }[] = [
  { value: "most_qty", label: "Most sold (quantity)" },
  { value: "least_qty", label: "Least sold (quantity)" },
  { value: "most_revenue", label: "Highest sales value" },
  { value: "least_revenue", label: "Lowest sales value" },
];

/**
 * A category / brand key for a line. The id when the product has one; the
 * legacy free-text label otherwise, so products that only ever carried the
 * text (and the terminal, which doesn't hold the category list) still group.
 */
const nameKey = (name: string) => `name:${name.trim().toLowerCase()}`;
function categoryKey(l: SalesReportLine): string {
  if (l.category_id) return l.category_id;
  return l.category?.trim() ? nameKey(l.category) : NONE;
}
function brandKey(l: SalesReportLine): string {
  if (l.brand_id) return l.brand_id;
  return l.brand?.trim() ? nameKey(l.brand) : NONE;
}

/** One product (one variant, when it has them). Deleted products group by name. */
export const lineKey = (l: SalesReportLine) => l.variant_id ?? l.product_id ?? nameKey(l.product_name);

export interface FilterOption { value: string; label: string; depth?: number }

/**
 * The dropdown lists: every known category (as a tree, children indented) and
 * brand, plus any free-text label a sold product carries that the list lacks,
 * plus "No category" / "No brand" when some line has none.
 */
export function filterOptions(
  bills: SalesReportBill[],
  categories: CatalogCategory[],
  brands: CatalogBrand[],
): { categories: FilterOption[]; brands: FilterOption[]; products: FilterOption[] } {
  const lines = bills.flatMap((b) => b.sale_items);

  const cats: FilterOption[] = [];
  const byParent = new Map<string | null, CatalogCategory[]>();
  const ids = new Set(categories.map((c) => c.id));
  for (const c of categories) {
    // A parent that no longer exists puts the child at the top level.
    const p = c.parent_id && ids.has(c.parent_id) ? c.parent_id : null;
    byParent.set(p, [...(byParent.get(p) ?? []), c]);
  }
  const walk = (parent: string | null, depth: number, seen: Set<string>) => {
    for (const c of byParent.get(parent) ?? []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      cats.push({ value: c.id, label: c.name, depth });
      walk(c.id, depth + 1, seen);
    }
  };
  walk(null, 0, new Set());
  const known = new Set(categories.map((c) => nameKey(c.name)));
  const extraCats = new Map<string, string>();
  for (const l of lines) {
    const k = categoryKey(l);
    if (k.startsWith("name:") && !known.has(k)) extraCats.set(k, l.category!.trim());
  }
  for (const [value, label] of [...extraCats].sort((a, b) => a[1].localeCompare(b[1]))) cats.push({ value, label });
  if (lines.some((l) => categoryKey(l) === NONE)) cats.push({ value: NONE, label: "No category" });

  const brs: FilterOption[] = brands.map((b) => ({ value: b.id, label: b.name }));
  const knownB = new Set(brands.map((b) => nameKey(b.name)));
  const extraB = new Map<string, string>();
  for (const l of lines) {
    const k = brandKey(l);
    if (k.startsWith("name:") && !knownB.has(k)) extraB.set(k, l.brand!.trim());
  }
  for (const [value, label] of [...extraB].sort((a, b) => a[1].localeCompare(b[1]))) brs.push({ value, label });
  if (lines.some((l) => brandKey(l) === NONE)) brs.push({ value: NONE, label: "No brand" });

  const prods = new Map<string, string>();
  for (const l of lines) if (!prods.has(lineKey(l))) prods.set(lineKey(l), l.product_name);
  const products = [...prods].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));

  return { categories: cats, brands: brs, products };
}

/** The chosen category and every category under it. */
function categorySet(chosen: string, categories: CatalogCategory[]): Set<string> {
  const out = new Set([chosen]);
  const chosenCat = categories.find((c) => c.id === chosen);
  // A free-text label also matches the real category of the same name, and back.
  if (chosenCat) out.add(nameKey(chosenCat.name));
  else if (chosen.startsWith("name:")) {
    for (const c of categories) if (nameKey(c.name) === chosen) out.add(c.id);
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of categories) {
      if (c.parent_id && out.has(c.parent_id) && !out.has(c.id)) {
        out.add(c.id);
        out.add(nameKey(c.name));
        grew = true;
      }
    }
  }
  return out;
}

export const isFiltered = (f: SalesFilter) => !!(f.category || f.brand || f.product);

/** Whether one line passes the filter. */
export function lineMatcher(f: SalesFilter, categories: CatalogCategory[], brands: CatalogBrand[]) {
  const cats = f.category && f.category !== NONE ? categorySet(f.category, categories) : null;
  const brandNames = new Set<string>();
  if (f.brand && f.brand !== NONE) {
    brandNames.add(f.brand);
    const b = brands.find((x) => x.id === f.brand);
    if (b) brandNames.add(nameKey(b.name));
    else for (const x of brands) if (nameKey(x.name) === f.brand) brandNames.add(x.id);
  }
  return (l: SalesReportLine) => {
    if (f.category === NONE ? categoryKey(l) !== NONE : cats && !cats.has(categoryKey(l))) return false;
    if (f.brand === NONE ? brandKey(l) !== NONE : f.brand && !brandNames.has(brandKey(l))) return false;
    if (f.product && lineKey(l) !== f.product) return false;
    return true;
  };
}

export interface SalesStats {
  /** With a filter: the matching lines' value (before bill discounts). Otherwise bill totals. */
  revenue: number;
  /** Bills — all of them, or those holding at least one matching line. */
  bills: number;
  items: number;
  tax: number;
  discount: number;
  /** revenue ÷ bills. */
  average: number;
}

/**
 * The bills that hold a matching line, and the figures for the tiles. Without
 * a filter this is the plain bill totals; with one, only the matching lines
 * count — a 10,000 bill with one 500 brake-oil line adds 500 to "Brake oil".
 */
export function filterSales<B extends SalesReportBill>(
  bills: B[],
  f: SalesFilter,
  categories: CatalogCategory[],
  brands: CatalogBrand[],
): { bills: B[]; stats: SalesStats } {
  if (!isFiltered(f)) {
    const revenue = bills.reduce((a, b) => a + Number(b.total), 0);
    return {
      bills,
      stats: {
        revenue,
        bills: bills.length,
        items: bills.reduce((a, b) => a + b.sale_items.reduce((x, l) => x + Number(l.quantity), 0), 0),
        tax: bills.reduce((a, b) => a + Number(b.tax), 0),
        discount: bills.reduce((a, b) => a + Number(b.discount), 0),
        average: bills.length ? revenue / bills.length : 0,
      },
    };
  }
  const match = lineMatcher(f, categories, brands);
  const kept: B[] = [];
  let revenue = 0;
  let items = 0;
  for (const b of bills) {
    const hits = b.sale_items.filter(match);
    if (!hits.length) continue;
    kept.push(b);
    revenue += hits.reduce((a, l) => a + Number(l.line_total), 0);
    items += hits.reduce((a, l) => a + Number(l.quantity), 0);
  }
  return {
    bills: kept,
    stats: {
      revenue,
      bills: kept.length,
      items,
      // Tax and discounts are bill-level and can't be split by line honestly.
      tax: kept.reduce((a, b) => a + Number(b.tax), 0),
      discount: kept.reduce((a, b) => a + Number(b.discount), 0),
      average: kept.length ? revenue / kept.length : 0,
    },
  };
}

export interface RankRow {
  key: string;
  name: string;
  /** Category / brand names (for a product row). */
  category: string;
  brand: string;
  quantity: number;
  revenue: number;
  bills: number;
  /** Share of the ranked lines' value, 0–100. */
  share: number;
}

/**
 * What sold, grouped by product, category or brand, over the lines that pass
 * the filter. Value is the line totals, before bill discounts.
 */
export function rankSales(
  bills: SalesReportBill[],
  f: SalesFilter,
  categories: CatalogCategory[],
  brands: CatalogBrand[],
  groupBy: GroupBy,
  sort: RankSort,
): RankRow[] {
  const match = lineMatcher(f, categories, brands);
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const brandName = new Map(brands.map((b) => [b.id, b.name]));
  const nameOfCat = (l: SalesReportLine) => (l.category_id ? catName.get(l.category_id) : null) ?? (l.category?.trim() || "No category");
  const nameOfBrand = (l: SalesReportLine) => (l.brand_id ? brandName.get(l.brand_id) : null) ?? (l.brand?.trim() || "No brand");

  const rows = new Map<string, RankRow & { billIds: Set<string> }>();
  for (const b of bills) {
    for (const l of b.sale_items) {
      if (!match(l)) continue;
      const key = groupBy === "product" ? lineKey(l) : groupBy === "category" ? categoryKey(l) : brandKey(l);
      let r = rows.get(key);
      if (!r) {
        const name = groupBy === "product" ? l.product_name : groupBy === "category" ? nameOfCat(l) : nameOfBrand(l);
        r = { key, name, category: nameOfCat(l), brand: nameOfBrand(l), quantity: 0, revenue: 0, bills: 0, share: 0, billIds: new Set() };
        rows.set(key, r);
      }
      r.quantity += Number(l.quantity);
      r.revenue += Number(l.line_total);
      r.billIds.add(b.id);
    }
  }
  const total = [...rows.values()].reduce((a, r) => a + r.revenue, 0);
  const out: RankRow[] = [...rows.values()].map(({ billIds, ...r }) => ({
    ...r,
    quantity: Math.round(r.quantity * 1000) / 1000,
    revenue: Math.round(r.revenue * 100) / 100,
    bills: billIds.size,
    share: total > 0 ? (r.revenue / total) * 100 : 0,
  }));
  const by: Record<RankSort, (a: RankRow, b: RankRow) => number> = {
    most_qty: (a, b) => b.quantity - a.quantity || b.revenue - a.revenue,
    least_qty: (a, b) => a.quantity - b.quantity || a.revenue - b.revenue,
    most_revenue: (a, b) => b.revenue - a.revenue || b.quantity - a.quantity,
    least_revenue: (a, b) => a.revenue - b.revenue || a.quantity - b.quantity,
  };
  return out.sort((a, b) => by[sort](a, b) || a.name.localeCompare(b.name));
}
