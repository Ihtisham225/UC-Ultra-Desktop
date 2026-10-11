/**
 * The shapes the new-return screen (NewReturnScreen) works in, and the
 * refund-to toggle shared with the bill's own return form. The form itself
 * was a pop-up here; it is a full page now, like the till.
 *
 * ⚠️ COPIED verbatim to the desktop app.
 */
import { Label } from "@/components/ui/label";

export interface ReturnProductOption {
  product_id: string;
  variant_id: string | null;
  name: string;
  price: number;
  /** Average landed cost — the default when goods go back to a supplier. */
  cost?: number | null;
  unit: string | null;
  /** Scanned at the return screen's search box. */
  barcode?: string | null;
}

/** A bill offered in the form's optional "Bill" field. */
export interface ReturnBillOption {
  id: string;
  receipt_number: string | null;
  created_at: string;
  total: number;
  customer_id: string | null;
  customer_name: string | null;
}

export interface NewReturnInput {
  customerId: string | null;
  /** Optional: the bill the goods came from. Recorded, not enforced. */
  saleId: string | null;
  /** Put the refund on the customer's khata instead of paying it out. */
  toLedger: boolean;
  accountId: string | null;
  reason: string | null;
  notes: string | null;
  deduction: number | null;
  lines: { product_id: string; variant_id: string | null; product_name: string; quantity: number; unit_price: number }[];
}

/** Goods going back to a supplier with no purchase behind them. */
export interface NewSupplierReturnInput {
  supplierId: string;
  /** Take the value off what the shop owes them instead of a money refund. */
  toLedger: boolean;
  accountId: string | null;
  reason: string | null;
  notes: string | null;
  lines: { product_id: string; variant_id: string | null; product_name: string; quantity: number; unit_cost: number }[];
}

/**
 * Where a refund goes: paid out of an account, or onto the customer's khata.
 * Shared by both return forms.
 */
export function RefundToToggle({
  toLedger, onChange, ledgerDisabledReason = null, label = "Refund to", ledgerLabel = "Customer's ledger",
}: {
  toLedger: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  ledgerLabel?: string;
  /** Set when there is no customer to credit — the ledger option is then off, and this says why. */
  ledgerDisabledReason?: string | null;
}) {
  const opt = (on: boolean, label: string, disabled = false) => (
    <button
      type="button"
      data-enter-skip
      disabled={disabled}
      title={disabled ? ledgerDisabledReason ?? undefined : undefined}
      onClick={() => onChange(on)}
      className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${toLedger === on ? "border-primary bg-primary/10 font-medium" : "enabled:hover:bg-muted/50"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        {opt(false, "Cash / account")}
        {opt(true, ledgerLabel, !!ledgerDisabledReason)}
      </div>
      {ledgerDisabledReason && <p className="text-xs text-muted-foreground">{ledgerDisabledReason}</p>}
    </div>
  );
}
