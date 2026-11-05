import { storedLineGoods } from "./purchase-line";

/**
 * Raw materials (cafe shops): what the shop buys to make things with or use in
 * the shop, and never sells — milk, sugar, spices, tissue, cups.
 *
 * A raw material is a product with "Sold at the till" off (products.is_sellable
 * = false), so the till never offers it. It is one of two kinds:
 *  - TRACKED: an ordinary stocked product. Purchases add to stock; batches,
 *    recipes and "Used & wasted" take it off, and that is when its cost reaches
 *    the P&L.
 *  - NOT TRACKED (salt, spices bought loose): stored as a service, so no stock
 *    moves. There is nothing to count it out of, so what was paid for it in a
 *    period IS its cost — untrackedMaterialsCost puts that in the P&L.
 *
 * ⚠️ Pure and COPIED verbatim to the desktop, which feeds it its offline store;
 * the web feeds it from Prisma. Rows may be synced (text Decimals) or typed.
 */

type Num = number | string | null | undefined;

export interface RawProduct {
  id: string;
  name: string;
  unit?: string | null;
  stock?: Num;
  is_service?: boolean | null;
  is_sellable?: boolean | null;
  is_active?: boolean | null;
}
export interface RawPurchase { id: string; created_at: string | Date }
export interface RawPurchaseItem {
  purchase_id: string;
  product_id: string | null;
  quantity: Num;
  unit_cost: Num;
  line_total?: Num;
  expense_amount?: Num;
}

export interface RawMaterialRow {
  id: string;
  name: string;
  unit: string | null;
  tracked: boolean;
  /** On the shelf now; null when not tracked. */
  stock: number | null;
  /** Bought in the period. */
  bought_qty: number;
  /** Paid for it in the period, goods plus the line's own charges. */
  bought_cost: number;
  is_active: boolean;
}

export const isRawMaterial = (p: { is_sellable?: boolean | null }) => p.is_sellable === false;
/** A raw material that keeps no count — bought means used. */
export const isUntrackedMaterial = (p: { is_sellable?: boolean | null; is_service?: boolean | null }) =>
  p.is_sellable === false && !!p.is_service;

const n = (v: Num) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Purchase lines bought within [from, to] (instants; either may be open). */
function linesInPeriod(purchases: RawPurchase[], items: RawPurchaseItem[], from?: string | Date | null, to?: string | Date | null) {
  const lo = from ? new Date(from).getTime() : -Infinity;
  const hi = to ? new Date(to).getTime() : Infinity;
  const inRange = new Set(
    purchases.filter((p) => {
      const t = new Date(p.created_at).getTime();
      return t >= lo && t <= hi;
    }).map((p) => p.id),
  );
  return items.filter((i) => inRange.has(i.purchase_id));
}

/** Every raw material, with what was bought of it in the period. Names A–Z. */
export function rawMaterialRows(
  products: RawProduct[],
  purchases: RawPurchase[],
  items: RawPurchaseItem[],
  from?: string | Date | null,
  to?: string | Date | null,
): RawMaterialRow[] {
  const bought = new Map<string, { qty: number; cost: number }>();
  for (const l of linesInPeriod(purchases, items, from, to)) {
    if (!l.product_id) continue;
    const b = bought.get(l.product_id) ?? { qty: 0, cost: 0 };
    b.qty += n(l.quantity);
    b.cost += storedLineGoods({ quantity: l.quantity, unit_cost: l.unit_cost, line_total: l.line_total }) + n(l.expense_amount);
    bought.set(l.product_id, b);
  }
  return products
    .filter(isRawMaterial)
    .map((p) => {
      const tracked = !p.is_service;
      const b = bought.get(p.id);
      return {
        id: p.id,
        name: p.name,
        unit: p.unit ?? null,
        tracked,
        stock: tracked ? n(p.stock) : null,
        bought_qty: r2(b?.qty ?? 0),
        bought_cost: r2(b?.cost ?? 0),
        is_active: p.is_active !== false,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** What untracked raw materials cost in the period — what was paid for them. */
export function untrackedMaterialsCost(
  products: RawProduct[],
  purchases: RawPurchase[],
  items: RawPurchaseItem[],
  from?: string | Date | null,
  to?: string | Date | null,
): number {
  const untracked = new Set(products.filter(isUntrackedMaterial).map((p) => p.id));
  if (!untracked.size) return 0;
  let total = 0;
  for (const l of linesInPeriod(purchases, items, from, to)) {
    if (!l.product_id || !untracked.has(l.product_id)) continue;
    total += storedLineGoods({ quantity: l.quantity, unit_cost: l.unit_cost, line_total: l.line_total }) + n(l.expense_amount);
  }
  return r2(total);
}

/** What each app plugs into the shared Raw materials screen. */
export interface RawMaterialsApi {
  list: (opts: { from: string; to: string }) => Promise<RawMaterialRow[]>;
  create: (input: { name: string; unit: string; tracked: boolean }) => Promise<{ ok: boolean; id?: string; error?: string }>;
}
