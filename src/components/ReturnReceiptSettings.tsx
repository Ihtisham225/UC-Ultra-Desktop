/**
 * Settings → Receipt → Return receipt: what the return slip prints, with a live
 * preview drawn by the slip's own paper (ReturnSlipPaper), so the switches show
 * exactly what the counter will hand over.
 *
 * ⚠️ COPIED verbatim to the desktop app; each app passes its own save.
 */
import { useMemo } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ReturnSlipPaper } from "@/components/ReturnReceiptDialog";
import type { PartyField } from "@/lib/party-fields";
import type { ReturnReceiptOptions, ReturnSlip } from "@/lib/return-receipt";

interface ShopLike {
  name: string;
  address?: string | null;
  phone?: string | null;
  currency?: string | null;
  receipt_header?: string | null;
  receipt_footer?: string | null;
  logo_url?: string | null;
}

export function ReturnReceiptSettings({
  shop, options, onChange, partyFields, onSave, busy = false, disabled = false,
}: {
  shop: ShopLike;
  options: ReturnReceiptOptions;
  onChange: (next: ReturnReceiptOptions) => void;
  /** The shop's own fields; customer ones can go on the slip. */
  partyFields: PartyField[];
  onSave: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const set = (patch: Partial<ReturnReceiptOptions>) => onChange({ ...options, ...patch });
  const customerFields = partyFields.filter((f) => f.applies !== "supplier" && f.label.trim());

  const toggles: { key: keyof Omit<ReturnReceiptOptions, "field_ids">; label: string; help: string; off?: boolean }[] = [
    { key: "show_logo", label: "Print shop logo", help: shop.logo_url ? "Your logo above the shop name." : "Upload a logo under Settings → Shop first.", off: !shop.logo_url },
    { key: "show_customer", label: "Print customer name & phone", help: "Who the goods came back from." },
    { key: "show_previous_balance", label: "Print customer's old balance", help: "Their khata balance, and where it stands after a refund put on the ledger." },
    { key: "show_reason", label: "Print the reason", help: "Defective, wrong item…" },
    { key: "show_notes", label: "Print notes", help: "Leave off if your notes are for staff only." },
  ];

  // A sample slip that exercises every switch, built from the shop's details.
  const sample = useMemo<ReturnSlip>(() => ({
    return_number: "RET-12",
    created_at: "2026-01-15T10:30:00",
    sale_receipt_number: "1024",
    refund_method: "cash",
    account_name: "Cash",
    reason: "Defective",
    notes: "Customer brought the box back",
    items_total: 1200,
    deduction: 0,
    total_refund: 1200,
    previous_balance: 2500,
    show_previous_balance: options.show_previous_balance,
    credited_to_ledger: false,
    customer: { name: "Ahmed Khan", phone: "0300 1234567" },
    customer_fields: customerFields
      .filter((f) => options.field_ids.includes(f.id))
      .map((f) => ({ label: f.label, value: `Sample ${f.label}` })),
    options,
    items: [{ product_name: "Sample product", quantity: 1, unit_price: 1200, line_total: 1200 }],
    shop: {
      name: shop.name,
      address: shop.address ?? null,
      phone: shop.phone ?? null,
      currency: shop.currency ?? "PKR",
      receipt_header: shop.receipt_header ?? null,
      receipt_footer: shop.receipt_footer ?? null,
      logo_url: shop.logo_url ?? null,
    },
  }), [shop, options, customerFields]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
      <Card className="shadow-card p-6 space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Undo2 className="size-4 text-primary" /> Return receipt</h3>
          <p className="text-sm text-muted-foreground">What the slip prints when goods come back. The header and footer are the sale receipt&apos;s.</p>
        </div>
        {toggles.map((t) => (
          <div key={t.key} className="flex items-center justify-between gap-4 py-1">
            <div>
              <Label>{t.label}</Label>
              <p className="text-xs text-muted-foreground">{t.help}</p>
            </div>
            <Switch
              checked={options[t.key]}
              onCheckedChange={(v) => set({ [t.key]: v } as Partial<ReturnReceiptOptions>)}
              disabled={disabled || !!t.off}
            />
          </div>
        ))}
        <div className="space-y-2 border-t pt-4">
          <div>
            <Label>Your customer fields</Label>
            <p className="text-xs text-muted-foreground">
              {customerFields.length === 0
                ? "Add your own customer fields under Settings → Shop, then choose here which ones print."
                : "Print these on the return slip when the customer has filled them in."}
            </p>
          </div>
          {customerFields.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-4 py-1">
              <span className="text-sm">{f.label}</span>
              <Switch
                checked={options.field_ids.includes(f.id)}
                onCheckedChange={(v) =>
                  set({ field_ids: v ? [...options.field_ids, f.id] : options.field_ids.filter((x) => x !== f.id) })}
                disabled={disabled}
                aria-label={`Print ${f.label} on the return receipt`}
              />
            </div>
          ))}
        </div>
        {!disabled && (
          <Button disabled={busy} onClick={onSave} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
            {busy ? "Saving…" : "Save return receipt"}
          </Button>
        )}
      </Card>
      <div className="space-y-2 lg:sticky lg:top-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium">Preview</h3>
          <span className="text-xs text-muted-foreground">Sample return · updates as you switch</span>
        </div>
        <ReturnSlipPaper slip={sample} />
      </div>
    </div>
  );
}
