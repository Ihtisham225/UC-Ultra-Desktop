/**
 * One khata payment, one row — however many bills it settled.
 *
 * A payment spread over several bills is stored as one settlement per bill,
 * sharing a `receipt_id`. Listed row by row it read as the payment having
 * been split (35,000 shown as 8,070 + 26,930). The history folds the parts
 * back into the payment the person actually made; entries with no receipt
 * (increases, older rows, cheque write-offs) stay one row each.
 *
 * Pure, so the web and the terminal fold the same way. A copy of the web app's src/lib/payment-parts.ts —
 * keep them in step.
 */

export interface PaymentPart {
  id: string;
  debt_id: string;
  kind: string;
  amount: number | string;
  discount?: number | string | null;
  receipt_id?: string | null;
}

export type PaymentRow<T extends PaymentPart> = T & {
  /** Every settlement this row stands for — delete them together. */
  ids: string[];
  /** The bills (khata rows) the payment was spread over. */
  debt_ids: string[];
  amount: number;
  discount: number;
};

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function groupPaymentParts<T extends PaymentPart>(parts: T[]): PaymentRow<T>[] {
  const out: PaymentRow<T>[] = [];
  const byReceipt = new Map<string, PaymentRow<T>>();
  for (const p of parts) {
    const key = p.receipt_id ? `${p.receipt_id}|${p.kind}` : null;
    const existing = key ? byReceipt.get(key) : undefined;
    if (existing) {
      existing.ids.push(p.id);
      if (!existing.debt_ids.includes(p.debt_id)) existing.debt_ids.push(p.debt_id);
      existing.amount = Math.round((existing.amount + num(p.amount)) * 100) / 100;
      existing.discount = Math.round((existing.discount + num(p.discount)) * 100) / 100;
      continue;
    }
    const row: PaymentRow<T> = { ...p, ids: [p.id], debt_ids: [p.debt_id], amount: num(p.amount), discount: num(p.discount) };
    out.push(row);
    if (key) byReceipt.set(key, row);
  }
  return out;
}
