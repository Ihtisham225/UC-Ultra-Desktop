import { useMemo } from "react";
import { ReceiptPaper } from "@/components/ReceiptDialog";
import { isOil } from "@/lib/oil";
import type { DeviceShop } from "@/lib/apiClient";

/**
 * The settings a receipt reads, as the form currently holds them — unsaved.
 * The preview renders from these, so flipping a switch changes the slip
 * before anyone presses Save.
 */
export interface ReceiptPreviewSettings {
  receipt_header: string;
  receipt_footer: string;
  receipt_terms: string;
  print_terms_by_default: boolean;
  show_tax_line: boolean;
  show_customer_on_receipt: boolean;
  show_imei_on_receipt: boolean;
  show_previous_balance_on_receipt: boolean;
  show_notes_on_receipt: boolean;
}

const SAMPLE_CUSTOMER = { name: "Ahmed Khan", phone: "0300 1234567" };

/**
 * A live receipt built from sample figures chosen to exercise every setting:
 * a customer, a bill paid in part, an old balance on their khata, a note, an
 * IMEI for a phone shop and an oil change for an oil shop. It goes through
 * `ReceiptPaper` — the very component the till prints from — so what the
 * preview shows is what the counter will hand over.
 */
/** A copy of the web app's `src/components/ReceiptPreview.tsx`. */
export function ReceiptPreview({ shop, settings }: { shop: DeviceShop; settings: ReceiptPreviewSettings }) {
  const sale = useMemo(() => {
    const taxRate = Number(shop.tax_rate ?? 0);
    const phoneShop = shop.store_type === "phone";
    const oilShop = isOil(shop);

    const items = oilShop
      ? [
          { product_name: "Castrol GTX 20W50", quantity: 4, unit_price: 850, line_total: 3400, unit_label: "LIT" },
          { product_name: "Oil filter", quantity: 1, unit_price: 600, line_total: 600, unit_label: "PCS" },
        ]
      : [
          {
            product_name: phoneShop ? "Samsung Galaxy A15" : "Sample product",
            quantity: 1,
            unit_price: 3400,
            line_total: 3400,
            unit_label: "pcs",
            imei1: phoneShop ? "356789012345678" : null,
          },
          { product_name: "Screen protector", quantity: 1, unit_price: 600, line_total: 600, unit_label: "pcs" },
        ];

    const subtotal = items.reduce((a, i) => a + i.line_total, 0);
    const tax = Math.round(((subtotal * taxRate) / 100) * 100) / 100;
    const total = subtotal + tax;
    const paid = 2500;

    return {
      id: "preview",
      receipt_number: `${shop.receipt_prefix ?? ""}1024`,
      // A fixed moment, so the preview reads the same on every render.
      created_at: "2026-01-15T10:30:00",
      subtotal,
      discount: 0,
      tax,
      total,
      amount_paid: paid,
      change_due: 0,
      balance_due: Math.max(0, total - paid),
      payment_method: "cash",
      payments: [{ account_name: "Cash", amount: paid }],
      items,
      notes: "Customer will collect the rest on Friday",
      previous_balance: 2500,
      oil_change: oilShop
        ? {
            vehicle_number: "LEA 07-1234",
            make: "Toyota",
            model_number: "Corolla",
            current_km: 84200,
            next_km: 89200,
          }
        : null,
      shop: {
        ...shop,
        ...settings,
        // Tax only prints where the shop charges it; the switch hides the line.
        tax_rate: taxRate,
      },
    };
  }, [shop, settings]);

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <ReceiptPaper
        sale={sale}
        customer={SAMPLE_CUSTOMER}
        withTerms={settings.print_terms_by_default && !!settings.receipt_terms.trim()}
      />
    </div>
  );
}
