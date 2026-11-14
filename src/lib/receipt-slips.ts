/**
 * What the shop prints on its OTHER slips — the purchase voucher and the
 * ledger payment receipt (Settings → Receipt). The sale receipt and the return
 * slip keep their own settings (shops.show_* columns, shops.return_receipt).
 *
 * Stored together on `shops.receipt_slips`; a shop that never set them gets the
 * defaults below, which are exactly what each slip printed before.
 *
 * Pure, and COPIED VERBATIM into the desktop (`src/lib/receipt-slips.ts`).
 */

export interface PurchaseSlipOptions {
  show_logo: boolean;
  /** Supplier (or walk-in seller) name and phone. */
  show_supplier: boolean;
  /** Each line's unit cost ("12 × 126.00"); off prints quantity and amount only. */
  show_unit_cost: boolean;
  /** Transport / loading charges, as their own line above the total. */
  show_expenses: boolean;
  /** What the shop owed the supplier before this bill, and what it owes after. */
  show_previous_balance: boolean;
  show_notes: boolean;
  /** A "Received by ____" line for the person who took delivery to sign. */
  show_signature: boolean;
}

export interface PaymentSlipOptions {
  show_logo: boolean;
  show_phone: boolean;
  /** Previous balance and the balance left after this payment. */
  show_balance: boolean;
  show_notes: boolean;
  /** "Thank you for your payment." on a customer's receipt. */
  show_thanks: boolean;
}

export interface ReceiptSlipOptions {
  purchase: PurchaseSlipOptions;
  payment: PaymentSlipOptions;
}

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const flag = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);

export function normalizePurchaseSlipOptions(raw: unknown): PurchaseSlipOptions {
  const o = obj(raw);
  return {
    show_logo: flag(o.show_logo, false),
    show_supplier: flag(o.show_supplier, true),
    show_unit_cost: flag(o.show_unit_cost, true),
    show_expenses: flag(o.show_expenses, true),
    show_previous_balance: flag(o.show_previous_balance, false),
    show_notes: flag(o.show_notes, true),
    show_signature: flag(o.show_signature, false),
  };
}

export function normalizePaymentSlipOptions(raw: unknown): PaymentSlipOptions {
  const o = obj(raw);
  return {
    show_logo: flag(o.show_logo, false),
    show_phone: flag(o.show_phone, true),
    show_balance: flag(o.show_balance, true),
    show_notes: flag(o.show_notes, true),
    show_thanks: flag(o.show_thanks, true),
  };
}

/** Anything stored → clean options for every slip. */
export function normalizeReceiptSlips(raw: unknown): ReceiptSlipOptions {
  const o = obj(raw);
  return {
    purchase: normalizePurchaseSlipOptions(o.purchase),
    payment: normalizePaymentSlipOptions(o.payment),
  };
}
