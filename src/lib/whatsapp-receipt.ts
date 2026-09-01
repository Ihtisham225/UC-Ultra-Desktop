/**
 * Client-side WhatsApp receipt, sent the same way as the debt reminders: a
 * wa.me click-to-chat link that opens the shopkeeper's own WhatsApp — web or
 * desktop — with the receipt already typed out. They press send themselves,
 * so it comes from their number and needs no Business API or template
 * approval.
 *
 * A wa.me link carries text only, so the slip is written as text rather than
 * attached as the PDF the old central-number route built.
 */
import { buildWaReminderUrl } from "@/lib/debt-reminder";

export interface ReceiptMessageLine {
  name: string;
  quantity: number;
  unit_label?: string | null;
  line_total: number;
}

export interface ReceiptMessageInput {
  shopName: string;
  receiptNumber: string | number;
  date: string;
  customerName?: string | null;
  lines: ReceiptMessageLine[];
  subtotal?: number | null;
  discount?: number | null;
  tax?: number | null;
  total: number;
  paid?: number | null;
  due?: number | null;
  currency: string;
  footer?: string | null;
  formatMoney: (n: number, currency: string) => string;
}

/** The receipt as WhatsApp text. The sender can edit it before sending. */
export function buildReceiptMessage(i: ReceiptMessageInput): string {
  const money = (n: number) => i.formatMoney(n, i.currency);
  const out: string[] = [];

  out.push(`*${i.shopName}*`);
  if (i.customerName) out.push(`Assalam-o-Alaikum ${i.customerName},`);
  out.push("", `Receipt #${i.receiptNumber} · ${i.date}`, "");

  for (const l of i.lines) {
    // "2 × Shawl — PKR 1,200" reads better on a phone than a column layout,
    // which WhatsApp would reflow anyway.
    const qty = l.unit_label ? `${l.quantity} ${l.unit_label}` : String(l.quantity);
    out.push(`${qty} × ${l.name} — ${money(l.line_total)}`);
  }

  out.push("");
  if (i.subtotal != null && (i.discount || i.tax)) out.push(`Subtotal: ${money(i.subtotal)}`);
  if (i.discount) out.push(`Discount: ${money(i.discount)}`);
  if (i.tax) out.push(`Tax: ${money(i.tax)}`);
  out.push(`*Total: ${money(i.total)}*`);
  if (i.paid != null && i.due != null && i.due > 0) {
    out.push(`Paid: ${money(i.paid)}`, `Balance: ${money(i.due)}`);
  }
  if (i.footer) out.push("", i.footer);
  out.push("", "Thank you!");

  return out.join("\n");
}

/** wa.me URL for a receipt, or null when the phone number is unusable. */
export function buildReceiptWaUrl(
  phone: string,
  message: string,
  dialCode = "92",
): string | null {
  return buildWaReminderUrl(phone, message, dialCode);
}
