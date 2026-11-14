/**
 * Settings → Receipt → Purchase receipt and Payment receipt: what those two
 * slips print, each with a live preview drawn by the slip's own paper, so the
 * switches show exactly what will be handed over.
 *
 * ⚠️ COPIED VERBATIM to the desktop app; each app passes its own save.
 */
import { useMemo, type ReactNode } from "react";
import { HandCoins, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PurchaseSlipPaper } from "@/components/PurchaseReceiptDialog";
import { PaymentSlipPaper } from "@/components/PaymentReceiptDialog";
import type { PaymentSlipOptions, PurchaseSlipOptions, ReceiptSlipOptions } from "@/lib/receipt-slips";
import type { PurchaseSlip } from "@/lib/purchase-receipt";
import type { PaymentReceiptDto } from "@/lib/payment-receipt";

interface ShopLike {
  name: string;
  address?: string | null;
  phone?: string | null;
  currency?: string | null;
  receipt_header?: string | null;
  receipt_footer?: string | null;
  logo_url?: string | null;
}

interface Toggle<K extends string> { key: K; label: string; help: string; off?: boolean }

export function ReceiptSlipSettings({
  shop, options, onChange, onSave, busy = false, disabled = false,
}: {
  shop: ShopLike;
  options: ReceiptSlipOptions;
  onChange: (next: ReceiptSlipOptions) => void;
  onSave: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const shopInfo = useMemo(() => ({
    name: shop.name,
    address: shop.address ?? null,
    phone: shop.phone ?? null,
    currency: shop.currency ?? "PKR",
    receipt_header: shop.receipt_header ?? null,
    receipt_footer: shop.receipt_footer ?? null,
    logo_url: shop.logo_url ?? null,
  }), [shop]);
  const logoHelp = shop.logo_url ? "Your logo above the shop name." : "Upload a logo under Settings → Shop first.";

  const purchaseToggles: Toggle<keyof PurchaseSlipOptions>[] = [
    { key: "show_logo", label: "Print shop logo", help: logoHelp, off: !shop.logo_url },
    { key: "show_supplier", label: "Print supplier name & phone", help: "Who the goods came from." },
    { key: "show_unit_cost", label: "Print each item's cost", help: "The @ column. Off prints quantity and amount only." },
    { key: "show_expenses", label: "Print expenses", help: "Transport and loading charges, on their own line." },
    { key: "show_previous_balance", label: "Print supplier's balance", help: "What you owed them before this bill, and the total you owe after it — or what they owe you." },
    { key: "show_notes", label: "Print notes", help: "Leave off if your notes are for staff only." },
    { key: "show_signature", label: "Print a \"Received by\" line", help: "For whoever took delivery to sign." },
  ];
  const paymentToggles: Toggle<keyof PaymentSlipOptions>[] = [
    { key: "show_logo", label: "Print shop logo", help: logoHelp, off: !shop.logo_url },
    { key: "show_phone", label: "Print the person's phone", help: "Under their name." },
    { key: "show_balance", label: "Print balances", help: "The balance before the payment and what is left after it." },
    { key: "show_notes", label: "Print notes", help: "The note typed with the payment." },
    { key: "show_thanks", label: "Print \"Thank you for your payment\"", help: "On receipts for customers." },
  ];

  const purchaseSample = useMemo<PurchaseSlip>(() => ({
    reference_number: "PO-58",
    created_at: "2026-01-15T10:30:00",
    supplier: { name: "Al Badar Traders", phone: "0300 1234567" },
    items: [
      { product_name: "3000 BT Polyester", quantity: 84, unit_cost: 110, line_total: 9240 },
      { product_name: "Colour bobbin", quantity: 5, unit_cost: 700, line_total: 3500 },
    ],
    subtotal: 12740,
    tax: 0,
    expenses_total: 300,
    total: 13040,
    paid: 5000,
    account_name: "Cash",
    notes: "Delivered by rickshaw",
    previous_balance: 20000,
    options: options.purchase,
    shop: shopInfo,
  }), [options.purchase, shopInfo]);

  const paymentSample = useMemo<PaymentReceiptDto>(() => ({
    id: "sample",
    receipt_number: "PR-14",
    person_name: "Ahmed Khan",
    phone: "0300 1234567",
    direction: "owed_to_me",
    amount: 10000,
    discount: 0,
    method: "Cash",
    balance_before: 25000,
    balance_after: 15000,
    payment_date: "2026-01-15",
    notes: "Paid at the counter",
    created_at: "2026-01-15T10:30:00",
  }), []);

  const card = <K extends string>(
    title: string,
    icon: ReactNode,
    blurb: string,
    toggles: Toggle<K>[],
    values: Record<K, boolean>,
    set: (patch: Partial<Record<K, boolean>>) => void,
    preview: ReactNode,
    previewNote: string,
  ) => (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
      <Card className="shadow-card p-6 space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">{icon} {title}</h3>
          <p className="text-sm text-muted-foreground">{blurb}</p>
        </div>
        {toggles.map((t) => (
          <div key={t.key} className="flex items-center justify-between gap-4 py-1">
            <div>
              <Label>{t.label}</Label>
              <p className="text-xs text-muted-foreground">{t.help}</p>
            </div>
            <Switch
              checked={values[t.key]}
              onCheckedChange={(v) => set({ [t.key]: v } as Partial<Record<K, boolean>>)}
              disabled={disabled || !!t.off}
              aria-label={t.label}
            />
          </div>
        ))}
      </Card>
      <div className="space-y-2 lg:sticky lg:top-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium">Preview</h3>
          <span className="text-xs text-muted-foreground">{previewNote}</span>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">{preview}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {card(
        "Purchase receipt",
        <Truck className="size-4 text-primary" />,
        "The voucher printed (or sent to the supplier) when goods come in. The footer is the sale receipt's.",
        purchaseToggles,
        options.purchase,
        (patch) => onChange({ ...options, purchase: { ...options.purchase, ...patch } }),
        <PurchaseSlipPaper slip={purchaseSample} />,
        "Sample purchase · updates as you switch",
      )}
      {card(
        "Ledger payment receipt",
        <HandCoins className="size-4 text-primary" />,
        "The slip for a payment received on the ledger, or paid to a supplier.",
        paymentToggles,
        options.payment,
        (patch) => onChange({ ...options, payment: { ...options.payment, ...patch } }),
        <PaymentSlipPaper receipt={paymentSample} shop={{ ...shopInfo, options: options.payment }} />,
        "Sample payment · updates as you switch",
      )}
      {!disabled && (
        <Button disabled={busy} onClick={onSave} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
          {busy ? "Saving…" : "Save purchase & payment receipts"}
        </Button>
      )}
    </div>
  );
}
