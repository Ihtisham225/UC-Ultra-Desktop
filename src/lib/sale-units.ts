/**
 * Sale lines are always STORED in the product's base unit — that's what keeps
 * stock, returns, investor lots and every report honest whether the counter
 * sold a litre or a drum. What the cashier actually rang up is kept alongside
 * as a label and a factor, and reconstructed here for anything a human reads:
 * receipts, the sales list, a reprint months later.
 *
 * Two separate things live on the line, and conflating them is a bug:
 *
 *  - `unit_label` is what the line is MEASURED in, and it is snapshotted on
 *    every sale (usually just the product's own unit — "litre", "pcs"). The
 *    receipt prints it in its own column, the way the shop's old bill did.
 *  - `unit_factor` is set only when that unit is NOT the base unit — a
 *    4-litre bottle of an oil stocked in litres. It is the only thing that
 *    triggers a conversion.
 *
 * So a label without a factor prints as-is and converts nothing. Keep this the
 * only place that does the division, so a receipt and a report can't disagree
 * about what was sold.
 */
export interface StoredSaleLine {
  quantity: number;
  unit_price: number;
  line_total?: number | null;
  unit_label?: string | null;
  unit_factor?: number | null;
}

export interface SoldLine {
  /** Quantity as it was billed — 2, when 2 bottles of 4 litres were sold. */
  quantity: number;
  /** The unit to print beside it, or null when the line records none. */
  unit: string | null;
  /** Price of one billed unit. */
  unitPrice: number;
  /** True when the billed unit differs from the product's base unit. */
  converted: boolean;
}

export function soldAs(item: StoredSaleLine): SoldLine {
  const factor = Number(item.unit_factor ?? 0);
  const unit = item.unit_label?.trim() || null;

  // No usable factor: the line is already in the unit it was billed in. This
  // covers the common case (a product sold in its own unit) and guards the
  // pathological one (a 0 factor, which would divide the quantity away).
  if (!Number.isFinite(factor) || factor <= 0) {
    return {
      quantity: Number(item.quantity),
      unit,
      unitPrice: Number(item.unit_price),
      converted: false,
    };
  }

  const quantity = Number(item.quantity) / factor;
  // Prefer the stored line total: the base unit price is rounded to two
  // decimals in the database, so multiplying it back up can be a cent out on
  // an awkward factor. The line total is what the customer actually paid.
  const total = item.line_total == null ? null : Number(item.line_total);
  const unitPrice =
    total != null && quantity !== 0 ? total / quantity : Number(item.unit_price) * factor;
  return { quantity, unit, unitPrice, converted: true };
}

/** Trims float noise from a quantity: 0.30000000000000004 → "0.3". */
export const formatUnitQty = (n: number): string => String(Math.round(n * 10000) / 10000);

/** "2 Bottle (4 L)" / "3.5" — the quantity as a receipt line should read. */
export function formatSoldQuantity(line: SoldLine): string {
  const q = formatUnitQty(line.quantity);
  return line.unit ? `${q} ${line.unit}` : q;
}
