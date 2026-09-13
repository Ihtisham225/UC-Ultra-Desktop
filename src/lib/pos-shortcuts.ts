/**
 * Keyboard shortcuts for the till.
 *
 * Chosen so none of them fights something the counter already relies on:
 * - Ctrl+Enter, not Ctrl+C — Ctrl+C is copy, and taking it would stop anyone
 *   copying a name or a number anywhere on the POS screen.
 * - Alt+W, not Ctrl+W — Ctrl+W closes the browser tab, and a page is not
 *   allowed to block it: the sale in progress would simply vanish.
 * - Alt+N, not Ctrl+S — Ctrl+S means "save", which is not "new sale".
 * - Ctrl+P stays Print; it already means print everywhere.
 * On a Mac the Ctrl shortcuts use Cmd, and Alt is Option.
 *
 * A copy of the web app's `src/lib/pos-shortcuts.ts` — keep the two in step.
 */

export type PosShortcut = "checkout" | "print" | "whatsapp" | "newSale";

interface KeyLike {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * ⚠️ Letters match on `code` (the physical key) as well as `key`. On a Mac,
 * Option+W types "∑" and Option+N is a dead key, so `key` alone would never
 * see "w" or "n" there.
 */
const isLetter = (e: KeyLike, letter: string) =>
  e.code === `Key${letter.toUpperCase()}` || e.key.toLowerCase() === letter;

export function matchPosShortcut(e: KeyLike): PosShortcut | null {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && !e.altKey && e.key === "Enter") return "checkout";
  if (mod && !e.altKey && !e.shiftKey && isLetter(e, "p")) return "print";
  if (e.altKey && !mod && isLetter(e, "w")) return "whatsapp";
  if (e.altKey && !mod && isLetter(e, "n")) return "newSale";
  return null;
}

const LABELS: Record<PosShortcut, { mac: string; other: string }> = {
  checkout: { mac: "⌘↵", other: "Ctrl+Enter" },
  print: { mac: "⌘P", other: "Ctrl+P" },
  whatsapp: { mac: "⌥W", other: "Alt+W" },
  newSale: { mac: "⌥N", other: "Alt+N" },
};

export function shortcutLabel(s: PosShortcut, isMac: boolean): string {
  return isMac ? LABELS[s].mac : LABELS[s].other;
}
