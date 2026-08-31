/**
 * Sale lines are always STORED in the product's base unit — that's what keeps
 * stock, returns, investor lots and every report honest whether the counter
 * sold a litre or a drum. What the cashier actually rang up is kept alongside
 * as a label and a factor, and reconstructed here for anything a human reads:
 * receipts, the sales list, a reprint months later.
 *
 * Keep this the only place that does the division, so a receipt and a report
 * can't disagree about what was sold.
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
  /** The unit billed in, or null when it was sold in the product's own unit. */
  unit: string | null;
  /** Price of one billed unit. */
  unitPrice: number;
}

export function soldAs(item: StoredSaleLine): SoldLine {
  const factor = Number(item.unit_factor ?? 0);
  const label = item.unit_label?.trim() || null;
  if (!label || !Number.isFinite(factor) || factor <= 0) {
    return { quantity: Number(item.quantity), unit: null, unitPrice: Number(item.unit_price) };
  }
  const quantity = Number(item.quantity) / factor;
  // Prefer the stored line total: the base unit price is rounded to two
  // decimals in the database, so multiplying it back up can be a cent out on
  // an awkward factor. The line total is what the customer actually paid.
  const total = item.line_total == null ? null : Number(item.line_total);
  const unitPrice =
    total != null && quantity !== 0 ? total / quantity : Number(item.unit_price) * factor;
  return { quantity, unit: label, unitPrice };
}

/** "2 Bottle" / "3.5" — the quantity as the receipt should print it. */
export function formatSoldQuantity(line: SoldLine): string {
  const q = Math.round(line.quantity * 10000) / 10000;
  return line.unit ? `${q} ${line.unit}` : String(q);
}
