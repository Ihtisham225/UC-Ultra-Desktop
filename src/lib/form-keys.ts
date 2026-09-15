/**
 * Enter-driven forms, for every dialog in the app.
 *
 *   Enter              next field (a dropdown opens on arrival, and moves on once chosen)
 *   Shift+Enter        previous field
 *   Enter on the last  save
 *   Ctrl/Cmd+Enter     save now, from any field — a notes box included
 *   (in a notes box Enter is a new line, except while the box is still empty)
 *   Ctrl/Cmd+Shift+Enter  save, then open a fresh form for another
 *
 * Wired once into `DialogContent` (components/ui/dialog), so a new dialog gets
 * it without doing anything. Fields are walked in PAGE order — the order they
 * are drawn in — so nobody maintains a list.
 *
 * What a dialog can say about itself:
 *   data-enter-chain="off"  on DialogContent — this dialog handles its own keys
 *                           (the POS checkout, the receipt, pickers)
 *   data-enter-submit       on the button Enter should press. Without one, the
 *                           last primary (default-variant) button in the
 *                           DialogFooter is used — never a destructive one.
 *   data-enter-skip         on a field (or a wrapper) Enter should step over
 *   data-enter-step         on anything else Enter should stop at
 *   data-add-new="<id>"     on DialogContent — what Ctrl/Cmd+Shift+Enter opens
 *                           next (an id registered with hooks/useAddNew)
 *   data-enter-save-new     on a form's own "Save & add another" button, which
 *                           Ctrl/Cmd+Shift+Enter then presses instead
 *
 * The till keeps its own numbered chain (lib/checkout-keys) and turns this off.
 *
 * A copy of the web app's `src/lib/form-keys.ts` — keep the two in step.
 */

const FIELD_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[role='combobox']",
  "button[aria-haspopup='dialog']",
  "button[aria-haspopup='listbox']",
  "[data-enter-step]",
].join(",");

const NOT_FIELDS = ["hidden", "checkbox", "radio", "button", "submit", "reset", "file", "range", "color", "image"];

function visible(el: HTMLElement): boolean {
  return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
}

function isField(el: HTMLElement): boolean {
  if (el.closest("[data-enter-skip]") || el.hasAttribute("cmdk-input")) return false;
  if ((el as HTMLInputElement).disabled || el.getAttribute("aria-disabled") === "true") return false;
  if (el.getAttribute("tabindex") === "-1") return false;
  if (el instanceof HTMLInputElement) {
    if (NOT_FIELDS.includes(el.type) || el.readOnly) return false;
  }
  if (el instanceof HTMLTextAreaElement && el.readOnly) return false;
  // A picker's hidden native <select> (Radix renders one for forms).
  if (el instanceof HTMLSelectElement && el.getAttribute("aria-hidden") === "true") return false;
  // ⚠️ Not `closest("[aria-hidden]")`: while a dropdown is open Radix marks the
  // whole dialog aria-hidden, and every field would vanish from the chain.
  return visible(el);
}

/** The dialog's fields in the order Enter walks them. */
export function fieldsIn(root: ParentNode): HTMLElement[] {
  const all = Array.from(root.querySelectorAll<HTMLElement>(FIELD_SELECTOR)).filter(isField);
  // A field nested inside another field (a button inside [data-enter-step]) counts once.
  return all.filter((el) => !all.some((other) => other !== el && other.contains(el)));
}

/** A dropdown or search picker — opened rather than typed into. */
export const isPicker = (el: HTMLElement) =>
  el.getAttribute("role") === "combobox" || el.hasAttribute("aria-haspopup");

/** A key press that types text, where Enter is ours to take. */
export function isTextEntry(el: HTMLElement): boolean {
  return el instanceof HTMLInputElement && !NOT_FIELDS.includes(el.type);
}

/** Land on a field: open it when it's a picker, otherwise focus and select it. */
export function focusField(el: HTMLElement) {
  el.focus({ preventScroll: false });
  el.scrollIntoView?.({ block: "nearest" });
  if (isPicker(el)) {
    if (el.getAttribute("aria-expanded") === "true") return;
    if (el.getAttribute("aria-haspopup") === "dialog") {
      el.click();
    } else {
      // A Radix Select opens on pointerdown or a key, never on click().
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    }
    return;
  }
  if (el instanceof HTMLInputElement && typeof el.select === "function") {
    try { el.select(); } catch { /* number/date inputs refuse select() in some browsers */ }
  }
}

/**
 * Move from `from` by `dir` fields and return the field landed on, or null when
 * there is none that way — past the last one, which the caller treats as "save".
 *
 * ⚠️ Use the return value, not document.activeElement: opening a dropdown moves
 * focus into its list synchronously, so activeElement is already an option.
 */
export function moveFrom(from: HTMLElement, root: HTMLElement, dir: 1 | -1): HTMLElement | null {
  const fields = fieldsIn(root);
  const current = fields.find((f) => f === from || f.contains(from));
  const at = current ? fields.indexOf(current) : -1;
  const next = at === -1 ? (dir === 1 ? fields[0] : undefined) : fields[at + dir];
  if (!next) return null;
  focusField(next);
  return next;
}

/** The button Enter should press to save this dialog, if it has one. */
export function submitButtonIn(root: HTMLElement): HTMLButtonElement | null {
  const usable = (b: HTMLButtonElement) => !b.disabled && visible(b);
  const explicit = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-enter-submit]")).filter(usable);
  if (explicit.length) return explicit[explicit.length - 1];

  const typed = Array.from(root.querySelectorAll<HTMLButtonElement>("button[type='submit']")).filter(usable);
  if (typed.length) return typed[typed.length - 1];

  const footers = root.querySelectorAll<HTMLElement>("[data-dialog-footer]");
  const footer = footers[footers.length - 1];
  if (!footer) return null;
  const primary = Array.from(footer.querySelectorAll<HTMLButtonElement>("button[data-variant='default']")).filter(usable);
  return primary[primary.length - 1] ?? null;
}

/** A form's own "Save & add another" button, when it has one. */
export function saveNewButtonIn(root: HTMLElement): HTMLButtonElement | null {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("[data-enter-save-new]")).find(
    (b) => !b.disabled && visible(b),
  ) ?? null;
}

/** Whether a dialog has anything to fill in — Ctrl/Cmd+Enter means nothing otherwise. */
export const hasFields = (root: HTMLElement) => fieldsIn(root).length > 0;
