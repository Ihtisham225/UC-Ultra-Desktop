/**
 * App-wide keyboard shortcuts — everything outside the till.
 *
 *   Ctrl/Cmd+G         Go to a page
 *   Ctrl/Cmd+E         Add something new
 *   Ctrl/Cmd+K         Search (SearchContext owns it)
 *   Ctrl/Cmd+/         The shortcut sheet
 *   Ctrl/Cmd+B         Show or hide the sidebar
 *   Ctrl/Cmd+J         Open or minimise the calculator
 *   Ctrl/Cmd+Shift+L   Switch between light and dark
 *   /                  Jump to the page's search box
 *   ↑ ↓ Enter          Move through a list and open a row
 *
 * In a form (lib/form-keys): Enter next field · Shift+Enter previous ·
 * Enter on the last field saves · Ctrl/Cmd+Enter saves now ·
 * Ctrl/Cmd+Shift+Enter saves and starts another.
 *
 * ⚠️⚠️ Why these letters. A browser never tells a page about Ctrl+N, Ctrl+T or
 * Ctrl+W (with or without Shift), so none of them can be used on ucultra.com —
 * see BROWSER_RESERVED in lib/pos-shortcuts. The desktop app's menu keeps
 * Ctrl+R (reload), Ctrl+M (minimise) and Ctrl+Shift+I (devtools). G and E are
 * only "find next" and "focus the search bar" in a browser, which a page may
 * take over, and nothing in the app used them.
 *
 * The till's own keys live in lib/pos-shortcuts and win on the POS screen.
 * A copy of the web app's `src/lib/shortcuts.ts` — keep the
 * two in step.
 */

export type AppShortcut = "goTo" | "addNew" | "shortcuts" | "sidebar" | "calculator" | "theme";

/** The three popups the app-wide keys open (components/shortcuts/AppShortcuts). */
export type ShortcutPopup = "goTo" | "addNew" | "shortcuts";

export const OPEN_POPUP_EVENT = "ucu:open-shortcut-popup";

/** Open a popup from a button — the header's keyboard icon, a hint in the sidebar. */
export function openShortcutPopup(which: ShortcutPopup) {
  window.dispatchEvent(new CustomEvent(OPEN_POPUP_EVENT, { detail: which }));
}

export interface KeyLike {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/** Physical key as well as the character, so a non-English layout still matches. */
export const isLetter = (e: KeyLike, letter: string) =>
  e.code === `Key${letter.toUpperCase()}` || e.key.toLowerCase() === letter;

export function matchAppShortcut(e: KeyLike): AppShortcut | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
  if (e.shiftKey) return isLetter(e, "l") ? "theme" : null;
  if (isLetter(e, "g")) return "goTo";
  if (isLetter(e, "e")) return "addNew";
  if (isLetter(e, "b")) return "sidebar";
  if (isLetter(e, "j")) return "calculator";
  // "/" is Shift+7 on some layouts, so the physical key is checked too.
  if (e.key === "/" || e.code === "Slash") return "shortcuts";
  return null;
}

/** A bare key (no Ctrl/Cmd/Alt) — what the list and search keys listen for. */
export const isBare = (e: KeyLike) => !e.ctrlKey && !e.metaKey && !e.altKey;

/**
 * Whether a keystroke is somebody typing. Bare-key shortcuts ("/", the arrows)
 * must never fire then, or a "/" in a product name would jump the cursor away.
 */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"].includes(el.type);
  }
  return el.getAttribute("role") === "combobox" || !!el.closest("[cmdk-root]");
}

const LABELS: Record<AppShortcut | "search" | "saveNow" | "saveNew", { mac: string; other: string }> = {
  goTo: { mac: "⌘G", other: "Ctrl+G" },
  addNew: { mac: "⌘E", other: "Ctrl+E" },
  shortcuts: { mac: "⌘/", other: "Ctrl+/" },
  search: { mac: "⌘K", other: "Ctrl+K" },
  sidebar: { mac: "⌘B", other: "Ctrl+B" },
  calculator: { mac: "⌘J", other: "Ctrl+J" },
  theme: { mac: "⌘⇧L", other: "Ctrl+Shift+L" },
  saveNow: { mac: "⌘↵", other: "Ctrl+Enter" },
  saveNew: { mac: "⌘⇧↵", other: "Ctrl+Shift+Enter" },
};

export type ShortcutLabel = keyof typeof LABELS;

export function appShortcutLabel(s: ShortcutLabel, isMac: boolean): string {
  return isMac ? LABELS[s].mac : LABELS[s].other;
}
