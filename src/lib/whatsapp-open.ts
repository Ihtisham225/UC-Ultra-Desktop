/**
 * Opening a pre-filled WhatsApp chat — receipts, payment slips, khata reminders.
 *
 * A wa.me link always lands on a web page first, which then asks the browser
 * to hand off to the installed app — so a shop with WhatsApp Desktop saw
 * WhatsApp Web flash up on every send. `whatsapp://send` opens the app
 * directly, but only works where the app is installed. So:
 *
 * - **Desktop terminal (Electron):** the main process checks whether anything
 *   handles `whatsapp://` and opens the app, or wa.me when nothing does. No
 *   question asked.
 * - **Phone browser:** wa.me already opens the app straight away; unchanged.
 * - **Computer browser:** a page can't tell whether an app is installed, so the
 *   first send asks ("WhatsApp app" / "WhatsApp Web") and remembers the answer
 *   on this computer. Settings → Receipt changes it later.
 *
 * ⚠️ COPIED verbatim into the desktop app (`src/lib/whatsapp-open.ts`).
 */
import { normalizeWaPhone } from "@/lib/debt-reminder";

export type WaTarget = "app" | "web";

const KEY = "ucu.whatsappTarget";
/** Fired when a computer browser has no remembered choice; WhatsAppChooser answers it. */
export const WA_CHOOSE_EVENT = "ucu:whatsapp-choose";

export interface WaChooseDetail {
  to: string;
  text: string;
}

type Bridge = { openWhatsApp?: (to: string, text: string) => Promise<unknown> };
const bridge = (): Bridge | undefined =>
  typeof window === "undefined" ? undefined : (window as unknown as { electronAPI?: Bridge }).electronAPI;

/** True inside the desktop terminal, which decides app-vs-web by itself. */
export const waDecidedByApp = () => !!bridge()?.openWhatsApp;

export function getWaTarget(): WaTarget | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "app" || v === "web" ? v : null;
  } catch {
    return null;
  }
}

/** Remember (or with null, forget) where this computer opens WhatsApp. */
export function setWaTarget(target: WaTarget | null) {
  try {
    if (target) localStorage.setItem(KEY, target);
    else localStorage.removeItem(KEY);
  } catch {
    /* private window — it just asks again next time */
  }
}

export const waAppUrl = (to: string, text: string) =>
  `whatsapp://send?phone=${to}&text=${encodeURIComponent(text)}`;
export const waWebUrl = (to: string, text: string) => `https://wa.me/${to}?text=${encodeURIComponent(text)}`;

/** Open the chat in the chosen place. Must run inside a click, or the browser blocks the new tab. */
export function launchWhatsApp(to: string, text: string, target: WaTarget) {
  if (target === "app") {
    // A link click hands an external protocol to the OS without leaving the page.
    const a = document.createElement("a");
    a.href = waAppUrl(to, text);
    a.rel = "noopener";
    a.click();
  } else {
    window.open(waWebUrl(to, text), "_blank", "noopener,noreferrer");
  }
}

const isPhone = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/**
 * Open a WhatsApp chat with `message` for `phone`. Returns false when the
 * number can't be a WhatsApp number (the caller says so); true once handled.
 */
export function openWhatsApp(phone: string, message: string, dialCode = "92"): boolean {
  const to = normalizeWaPhone(phone, dialCode);
  if (to.length < 8) return false;

  const b = bridge();
  if (b?.openWhatsApp) {
    void b.openWhatsApp(to, message);
    return true;
  }
  if (isPhone()) {
    launchWhatsApp(to, message, "web");
    return true;
  }
  const target = getWaTarget();
  if (target) {
    launchWhatsApp(to, message, target);
    return true;
  }
  window.dispatchEvent(new CustomEvent<WaChooseDetail>(WA_CHOOSE_EVENT, { detail: { to, text: message } }));
  return true;
}
