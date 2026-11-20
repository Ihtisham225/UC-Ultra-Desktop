/**
 * Returns made INSIDE an open bill — the customer took 10 cakes, handed 2
 * back, took 10 kheer, handed 4 back, and the bill was closed once.
 *
 * A stored line's `quantity` is the NET figure that left the shop (8 cakes);
 * `returned_quantity` is what came back before the bill was closed (2). Both
 * are in the product's base unit, like every stored line. Everything that
 * counts — stock, the khata, returns made later, reports — reads only the net
 * quantity and line total, so this file is just for the slip: it rebuilds
 * what was TAKEN and what was RETURNED so the customer sees both.
 *
 * ⚠️ COPIED verbatim to the desktop (src/lib/bill-returns.ts). Change both.
 */

export interface BillLine {
  product_name?: string | null;
  quantity: number;
  unit_price: number;
  line_total?: number | null;
  unit_label?: string | null;
  unit_factor?: number | null;
  returned_quantity?: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const returnedOf = (line: BillLine): number => {
  const r = Number(line.returned_quantity ?? 0);
  return Number.isFinite(r) && r > 0 ? r : 0;
};

/** True when any line of the bill had something handed back before it was closed. */
export const hasBillReturns = (lines: BillLine[] | null | undefined): boolean =>
  (lines ?? []).some((l) => returnedOf(l) > 0);

/** What a returned quantity was worth on the bill. */
export const returnedAmount = (line: BillLine): number =>
  round2(returnedOf(line) * Number(line.unit_price));

/**
 * The line as it was TAKEN — before anything came back. Same shape as the
 * stored line, so `soldAs` can turn it into bottles / kilos for printing.
 */
export function takenLine<T extends BillLine>(line: T): T {
  const r = returnedOf(line);
  if (r === 0) return line;
  return {
    ...line,
    quantity: Number(line.quantity) + r,
    line_total: round2(Number(line.line_total ?? Number(line.unit_price) * Number(line.quantity)) + returnedAmount(line)),
  };
}

/** One line per product that came back, shaped like a stored line. */
export function returnedLines<T extends BillLine>(lines: T[]): T[] {
  return lines
    .filter((l) => returnedOf(l) > 0)
    .map((l) => ({ ...l, quantity: returnedOf(l), line_total: returnedAmount(l) }));
}

/** Taken − returned = the bill's subtotal (before discount and tax). */
export function billReturnTotals(lines: BillLine[]): { taken: number; returned: number } {
  let taken = 0;
  let returned = 0;
  for (const l of lines) {
    taken += Number(takenLine(l).line_total ?? 0);
    returned += returnedAmount(l);
  }
  return { taken: round2(taken), returned: round2(returned) };
}
