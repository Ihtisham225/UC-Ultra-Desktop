/**
 * "How many did we sell, and how many are left?" — one row per thing on the
 * shelf (a variant when the product has them, else the product), for a period.
 *
 * Pure, so the web report (fed by server queries) and the terminal's report
 * (fed by its offline store) cannot disagree. A copy of the web app's src/lib/product-movement.ts
 * — keep them in step.
 *
 * - `sold` / `returned` / `bought` are the period's quantities, in the
 *   product's BASE unit (sale lines always are — see sale-units.ts).
 * - `net_sold` = sold − returned: goods that came back didn't leave.
 * - `sales_value` = what those lines were billed at, less what was refunded
 *   for returned lines — before any bill-level discount, which belongs to the
 *   bill, not to a product.
 * - `left` is the stock NOW, not at the end of the period: it is the figure
 *   the shop can act on. Services hold no stock, so it is null for them.
 */

export interface MovementProduct {
  id: string;
  name: string;
  sku?: string | null;
  unit?: string | null;
  stock?: number | string | null;
  is_service?: boolean | null;
  is_active?: boolean | null;
  low_stock_threshold?: number | string | null;
}

export interface MovementVariant {
  id: string;
  product_id: string;
  name: string;
  sku?: string | null;
  stock?: number | string | null;
  low_stock_threshold?: number | string | null;
}

export interface MovementLine {
  product_id: string | null;
  variant_id?: string | null;
  product_name?: string | null;
  quantity: number | string;
  /** Billed / refunded amount of the line (sales and returns only). */
  line_total?: number | string | null;
}

export interface MovementRow {
  key: string;
  product_id: string | null;
  variant_id: string | null;
  name: string;
  sku: string | null;
  unit: string | null;
  is_service: boolean;
  bought: number;
  sold: number;
  returned: number;
  net_sold: number;
  sales_value: number;
  /** Stock now; null for a service or a product that no longer exists. */
  left: number | null;
  low: boolean;
}

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const r2 = (n: number) => Math.round(n * 100) / 100;
/** Quantities can be fractional (litres); keep them tidy without losing 3.7. */
const q = (n: number) => Math.round(n * 1000) / 1000;

export function productMovement(input: {
  products: MovementProduct[];
  variants: MovementVariant[];
  sold: MovementLine[];
  returned: MovementLine[];
  bought: MovementLine[];
}): MovementRow[] {
  const productById = new Map(input.products.map((p) => [p.id, p]));
  const variantById = new Map(input.variants.map((v) => [v.id, v]));
  const hasVariants = new Set(input.variants.map((v) => v.product_id));
  const rows = new Map<string, MovementRow>();

  const blank = (key: string, product: MovementProduct | undefined, variant: MovementVariant | undefined, fallbackName: string): MovementRow => {
    const isService = !!product?.is_service;
    const stock = variant ? variant.stock : product?.stock;
    const threshold = num(variant ? variant.low_stock_threshold : product?.low_stock_threshold);
    const left = isService || (!product && !variant) ? null : q(num(stock));
    return {
      key,
      product_id: product?.id ?? variant?.product_id ?? null,
      variant_id: variant?.id ?? null,
      name: product ? (variant ? `${product.name} — ${variant.name}` : product.name) : fallbackName,
      sku: variant?.sku ?? product?.sku ?? null,
      unit: product?.unit ?? null,
      is_service: isService,
      bought: 0, sold: 0, returned: 0, net_sold: 0, sales_value: 0,
      left,
      low: left !== null && left > 0 && left <= threshold,
    };
  };

  // Every active product (or each of its variants) gets a row, sold or not —
  // "what didn't move" is half of what this report is for.
  for (const p of input.products) {
    if (p.is_active === false) continue;
    if (hasVariants.has(p.id)) {
      for (const v of input.variants) if (v.product_id === p.id) rows.set(v.id, blank(v.id, p, v, p.name));
    } else {
      rows.set(p.id, blank(p.id, p, undefined, p.name));
    }
  }

  const rowFor = (l: MovementLine): MovementRow | null => {
    const key = l.variant_id || l.product_id;
    if (!key) return null;
    let row = rows.get(key);
    if (!row) {
      // A line for an archived product, a deleted one, or a variant row we
      // didn't create — it still sold, so it still shows.
      const variant = l.variant_id ? variantById.get(l.variant_id) : undefined;
      const product = productById.get(l.product_id ?? variant?.product_id ?? "");
      row = blank(key, product, variant, l.product_name?.trim() || "Deleted product");
      rows.set(key, row);
    }
    return row;
  };

  for (const l of input.sold) {
    const row = rowFor(l);
    if (!row) continue;
    row.sold += num(l.quantity);
    row.sales_value += num(l.line_total);
  }
  for (const l of input.returned) {
    const row = rowFor(l);
    if (!row) continue;
    row.returned += num(l.quantity);
    row.sales_value -= num(l.line_total);
  }
  for (const l of input.bought) {
    const row = rowFor(l);
    if (!row) continue;
    row.bought += num(l.quantity);
  }

  return [...rows.values()]
    .map((r) => ({
      ...r,
      bought: q(r.bought),
      sold: q(r.sold),
      returned: q(r.returned),
      net_sold: q(r.sold - r.returned),
      sales_value: r2(r.sales_value),
    }))
    .sort((a, b) => b.net_sold - a.net_sold || b.sales_value - a.sales_value || a.name.localeCompare(b.name));
}

export function movementTotals(rows: MovementRow[]) {
  let sold = 0, returned = 0, value = 0, left = 0, moved = 0, still = 0;
  for (const r of rows) {
    sold += r.sold;
    returned += r.returned;
    value += r.sales_value;
    if (r.left !== null) left += Math.max(0, r.left);
    if (r.net_sold > 0) moved += 1;
    else if (!r.is_service && r.sold === 0 && r.returned === 0 && (r.left ?? 0) > 0) still += 1;
  }
  return {
    units_sold: q(sold - returned),
    units_returned: q(returned),
    sales_value: r2(value),
    units_left: q(left),
    products_sold: moved,
    /** In stock but nothing sold in the period — the slow movers. */
    not_moving: still,
  };
}
