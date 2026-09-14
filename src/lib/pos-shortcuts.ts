/**
 * Keyboard shortcuts for the till.
 *
 * - Ctrl/Cmd+Enter — open checkout, and place the order from inside it.
 * - Ctrl/Cmd+P — print the receipt.
 * - Ctrl/Cmd+W — send the receipt on WhatsApp.
 * - Ctrl/Cmd+N — start a new sale.
 * - Ctrl/Cmd+Shift+Backspace — clear the cart (asks first).
 * On a Mac the Ctrl shortcuts use Cmd. The shop asked for Cmd-style keys
 * throughout, so there are no Alt shortcuts.
 *
 * ⚠️⚠️ Ctrl/Cmd+W and Ctrl/Cmd+N are the BROWSER'S keys — close tab and new
 * window — and a web page is never told about them, let alone allowed to stop
 * them. They work in the desktop app (whose own menu no longer claims them) but
 * NOT on ucultra.com in a browser: there, Ctrl+W closes the tab. The sale is
 * already saved by the time the receipt is showing, so nothing is lost, but the
 * web app must not advertise those two keys — see BROWSER_RESERVED.
 *
 * Ctrl+C (copy) and Ctrl+S (save) are still deliberately left alone.
 *
 * A copy of the web app's `src/lib/pos-shortcuts.ts` — keep the two in step.
 */

export type PosShortcut = "checkout" | "print" | "whatsapp" | "newSale" | "clearCart";

interface KeyLike {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/** Physical key as well as the character, so a non-English layout still matches. */
const isLetter = (e: KeyLike, letter: string) =>
  e.code === `Key${letter.toUpperCase()}` || e.key.toLowerCase() === letter;

export function matchPosShortcut(e: KeyLike): PosShortcut | null {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod || e.altKey) return null;
  if (e.key === "Enter") return "checkout";
  if (e.shiftKey) return e.key === "Backspace" ? "clearCart" : null;
  if (isLetter(e, "p")) return "print";
  if (isLetter(e, "w")) return "whatsapp";
  if (isLetter(e, "n")) return "newSale";
  return null;
}

/**
 * Enter with no modifier — what the product search, a barcode scanner and the
 * Enter chain act on.
 *
 * ⚠️⚠️ Ctrl/Cmd+Enter is ALSO an Enter keydown, delivered to the focused field
 * before the window's shortcut listener sees it. The search box checked only
 * `key === "Enter"`, so Cmd+Enter from the till (where focus returns after
 * every line) added the first product on the grid to the cart AND opened
 * checkout — the counter found an item nobody rang up on the bill. Any field
 * that acts on Enter must use this, not a bare key check.
 */
export function isPlainEnter(e: KeyLike & { isComposing?: boolean }): boolean {
  return e.key === "Enter" && !e.isComposing && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
}

/** Shortcuts a browser keeps for itself — they only work in the desktop app. */
export const BROWSER_RESERVED: readonly PosShortcut[] = ["whatsapp", "newSale"];

const LABELS: Record<PosShortcut, { mac: string; other: string }> = {
  checkout: { mac: "⌘↵", other: "Ctrl+Enter" },
  print: { mac: "⌘P", other: "Ctrl+P" },
  whatsapp: { mac: "⌘W", other: "Ctrl+W" },
  newSale: { mac: "⌘N", other: "Ctrl+N" },
  clearCart: { mac: "⌘⇧⌫", other: "Ctrl+Shift+Backspace" },
};

export function shortcutLabel(s: PosShortcut, isMac: boolean): string {
  return isMac ? LABELS[s].mac : LABELS[s].other;
}
