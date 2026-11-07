import { fmtDate } from "@/lib/date-format";
/**
 * Client-side helpers for sending a debt reminder over WhatsApp via a wa.me
 * click-to-chat link. The message opens in the shop owner's own WhatsApp with
 * the debt details pre-filled — no Business API / template approval needed.
 * Mirrors how DigiKhata sends its reminders, so migrants feel at home.
 */

/**
 * Turn a stored phone number into the digits-only international form wa.me
 * expects (no "+", spaces or dashes). Shops here default to PKR, so a local
 * Pakistani number (leading 0, e.g. 03001234567) is promoted to +92.
 */
export function normalizeWaPhone(raw: string, defaultDialCode = "92"): string {
  let d = (raw || "").replace(/[^\d]/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2); // 0092… → 92…
  if (d.startsWith("0")) d = defaultDialCode + d.slice(1); // 0300… → 92300…
  // Bare 10-digit local mobile (3XXXXXXXXX) → prepend dial code.
  else if (d.length === 10 && d.startsWith("3")) d = defaultDialCode + d;
  return d;
}

export interface DebtReminderInput {
  personName: string;
  shopName: string;
  balance: number;
  currency: string;
  dueDate?: string | null;
  /** Formats a number as money for the given currency, e.g. "PKR 1,200". */
  formatMoney: (n: number, currency: string) => string;
}

/** Build the pre-filled reminder text. Owner can still edit before sending. */
export function buildDebtReminderMessage(i: DebtReminderInput): string {
  const lines = [
    `Assalam-o-Alaikum ${i.personName},`,
    "",
    `This is a payment reminder from ${i.shopName}.`,
    `Outstanding balance: ${i.formatMoney(i.balance, i.currency)}`,
  ];
  if (i.dueDate) lines.push(`Due date: ${fmtDate(i.dueDate)}`);
  lines.push("", "Kindly clear your dues at your earliest convenience. Thank you!");
  return lines.join("\n");
}

/**
 * The WhatsApp message for any ledger, whichever way it faces. A reminder only
 * makes sense when the person owes the shop; the Ledger now offers the button
 * on every account, so the other cases get a plain statement of where it stands.
 */
export function buildLedgerMessage(
  i: DebtReminderInput & { direction: "owed_to_me" | "i_owe" | string },
): string {
  if (i.direction === "owed_to_me" && i.balance > 0) return buildDebtReminderMessage(i);
  const lines = [`Assalam-o-Alaikum ${i.personName},`, ""];
  if (i.balance <= 0) {
    lines.push(`Your account with ${i.shopName} is fully settled. Thank you!`);
  } else {
    lines.push(
      `This is ${i.shopName}. Our records show we owe you ${i.formatMoney(i.balance, i.currency)}.`,
    );
    if (i.dueDate) lines.push(`Due date: ${fmtDate(i.dueDate)}`);
    lines.push("", "Please get in touch to arrange payment. Thank you!");
  }
  return lines.join("\n");
}

/** Full wa.me URL with the message encoded, or null if the phone is unusable. */
export function buildWaReminderUrl(phone: string, message: string, dialCode = "92"): string | null {
  const to = normalizeWaPhone(phone, dialCode);
  if (to.length < 8) return null;
  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
}
