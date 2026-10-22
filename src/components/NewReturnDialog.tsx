/**
 * The shapes the new-return screen (NewReturnScreen) works in, and the
 * refund-to toggle shared with the bill's own return form (and ChoiceToggle,
 * the keyboard-driven two-way switch both are built from). The form itself
 * was a pop-up here; it is a full page now, like the till.
 *
 * ⚠️ COPIED verbatim to the desktop app.
 */
import { useRef, type KeyboardEvent, type ReactNode } from "react";
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

/** One choice in a {@link ChoiceToggle}. */
export interface ToggleOption<T> {
  value: T;
  label: ReactNode;
  /** A smaller second line under the label. */
  hint?: ReactNode;
  disabled?: boolean;
  /** Shown on hover when disabled — why it can't be chosen. */
  title?: string;
}

/**
 * Two (or more) side-by-side buttons that behave like a radio group, so the
 * counter can work them without the mouse: ←/→ (or ↑/↓) move the choice,
 * skipping a disabled one, and Enter calls `onEnter` — the screen moves on.
 *
 * With `step`, the CHOSEN button carries `data-checkout-step`, so the group is
 * one stop in a screen's Enter chain (lib/checkout-keys) and arriving lands on
 * the current choice. Without it, the buttons are `data-enter-skip`: a form
 * driven by the dialog's generic Enter chain walks past them.
 */
export function ChoiceToggle<T extends string | boolean>({
  value, options, onChange, step, onEnter, label, className = "flex gap-2", buttonClassName = "flex-1 px-3 py-2 text-sm",
}: {
  value: T;
  options: ToggleOption<T>[];
  onChange: (v: T) => void;
  step?: number;
  onEnter?: () => void;
  /** Read out for the group (screen readers). */
  label?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, at: number) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      if (!onEnter) return;
      e.preventDefault();
      // The focused button may not be the chosen one (a click elsewhere, Tab):
      // Enter takes what is focused, like Space, then moves on.
      if (!options[at].disabled && options[at].value !== value) onChange(options[at].value);
      onEnter();
      return;
    }
    const back = e.key === "ArrowLeft" || e.key === "ArrowUp";
    const fwd = e.key === "ArrowRight" || e.key === "ArrowDown";
    if (!back && !fwd) return;
    e.preventDefault();
    // Left means "the one before" on screen — reversed when the page is RTL.
    const horizontal = e.key === "ArrowLeft" || e.key === "ArrowRight";
    const rtl = horizontal && getComputedStyle(e.currentTarget).direction === "rtl";
    const dir = (fwd ? 1 : -1) * (rtl ? -1 : 1);
    const n = options.length;
    for (let i = 1; i < n; i++) {
      const next = (at + dir * i + n) % n;
      if (options[next].disabled) continue;
      onChange(options[next].value);
      refs.current[next]?.focus();
      return;
    }
  };
  return (
    <div role="radiogroup" aria-label={label} className={className}>
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={String(o.value)}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={checked}
            // Roving focus: Tab reaches the group once, on the current choice.
            tabIndex={checked ? 0 : -1}
            data-checkout-step={checked ? step : undefined}
            data-enter-skip={step === undefined ? "" : undefined}
            disabled={o.disabled}
            title={o.disabled ? o.title : undefined}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`rounded-md border leading-tight transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName} ${checked ? "border-primary bg-primary/10 font-medium" : "enabled:hover:bg-muted/50"}`}
          >
            {o.label}
            {o.hint && <span className="block text-[10px] font-normal text-muted-foreground">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Where a refund goes: paid out of an account, or onto the customer's khata.
 * Shared by both return forms. ←/→ switch it; with `step`, it is a stop in the
 * screen's Enter chain and Enter calls `onEnter`.
 */
export function RefundToToggle({
  toLedger, onChange, ledgerDisabledReason = null, label = "Refund to", ledgerLabel = "Customer's ledger", step, onEnter,
}: {
  toLedger: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  ledgerLabel?: string;
  /** Set when there is no customer to credit — the ledger option is then off, and this says why. */
  ledgerDisabledReason?: string | null;
  step?: number;
  onEnter?: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <ChoiceToggle
        value={toLedger}
        onChange={onChange}
        label={label}
        step={step}
        onEnter={onEnter}
        options={[
          { value: false, label: "Cash / account" },
          { value: true, label: ledgerLabel, disabled: !!ledgerDisabledReason, title: ledgerDisabledReason ?? undefined },
        ]}
      />
      {ledgerDisabledReason && <p className="text-xs text-muted-foreground">{ledgerDisabledReason}</p>}
    </div>
  );
}
