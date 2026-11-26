/**
 * The platform's support contact — what the Support page, the billing page and
 * the "subscription required" screen tell people to use. Edited by the super
 * admin in /admin → Settings and stored in platform_settings (`support.*`);
 * see getSupportContact in lib/site-settings. Pure, so client pages can format
 * links from the values the server hands them.
 */

export interface SupportContact {
  /** WhatsApp number as written, e.g. "0310 5892935" or "+92 310 5892935". */
  whatsapp: string;
  /** Number to call, as written. Blank = the WhatsApp number. */
  phone: string;
  email: string;
  /** Who runs support ("Tech Town Swat"). */
  companyName: string;
  /** Their website, shown under "Created by". Blank hides the link. */
  companyUrl: string;
}

/** What the pages showed before this was editable — used until a value is saved. */
export const SUPPORT_DEFAULTS: SupportContact = {
  whatsapp: "0310 5892935",
  phone: "",
  email: "uihtisham0@gmail.com",
  companyName: "Tech Town Swat",
  companyUrl: "https://techtownswat.com",
};

/** Digits in international form: "0310 5892935" → "923105892935" (Pakistan by default). */
export function internationalDigits(raw: string, defaultCountryCode = "92"): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = defaultCountryCode + digits.slice(1);
  return digits;
}

/** wa.me link for a number, optionally with a prefilled message. Null when there's no number. */
export function whatsappHref(number: string, text?: string): string | null {
  const d = internationalDigits(number);
  if (!d) return null;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** tel: link. Null when there's no number. */
export function telHref(number: string): string | null {
  const d = internationalDigits(number);
  return d ? `tel:+${d}` : null;
}

/** The number to show/call: the phone, else the WhatsApp number. */
export function callNumber(c: SupportContact): string {
  return c.phone.trim() || c.whatsapp.trim();
}
