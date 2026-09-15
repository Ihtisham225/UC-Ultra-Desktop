/**
 * Keyboard on list pages: "/" jumps to the page's search box, ↑ ↓ move through
 * the table's rows, Enter opens the highlighted one.
 *
 * Found from the page itself rather than wired into each of thirty screens:
 *   data-page-search  on the search input, when the placeholder doesn't say "Search"
 *   data-row-open     on the control Enter should press for a row
 * Without data-row-open, Enter presses the row's details / view button, then a
 * clickable row itself, then its edit button — never a delete.
 *
 * A copy of the web app's `src/lib/list-keys.ts` — keep the two in step.
 */

const visible = (el: Element) => el.getClientRects().length > 0;

/** Inside a dialog, a popup menu or a list with its own arrow keys. */
const OWN_ARROWS = "[role='dialog'], [role='menu'], [role='listbox'], [role='tablist'], [role='radiogroup'], [role='slider'], [role='grid'], [cmdk-root], [data-radix-popper-content-wrapper]";

export function pageSearchInput(root: ParentNode = document): HTMLInputElement | null {
  const scope = root.querySelector("main") ?? root;
  const explicit = Array.from(scope.querySelectorAll<HTMLInputElement>("[data-page-search]")).find(visible);
  if (explicit) return explicit;
  return (
    Array.from(scope.querySelectorAll<HTMLInputElement>("input")).find((el) => {
      if (!visible(el) || el.disabled || el.closest(OWN_ARROWS)) return false;
      const label = `${el.type} ${el.placeholder} ${el.getAttribute("aria-label") ?? ""}`;
      return /search/i.test(label);
    }) ?? null
  );
}

/** Whether arrow keys pressed on `target` belong to something else. */
export const arrowsBelongElsewhere = (target: Element | null) => !!target?.closest(OWN_ARROWS);

/** The rows of the table being moved through: the focused one's, else the page's first. */
export function listRows(active: Element | null, root: ParentNode = document): HTMLTableRowElement[] {
  const scope = root.querySelector("main") ?? root;
  const focusedTable = active?.closest("table");
  const tables = focusedTable ? [focusedTable] : Array.from(scope.querySelectorAll("table"));
  for (const table of tables) {
    if (!visible(table) || table.closest(OWN_ARROWS)) continue;
    const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody > tr")).filter(
      // A "no results" row or an expanded detail row is one wide cell, not a record.
      (tr) => visible(tr) && tr.cells.length >= 2,
    );
    if (rows.length) return rows;
  }
  return [];
}

export function focusRow(row: HTMLTableRowElement) {
  if (!row.hasAttribute("tabindex")) row.setAttribute("tabindex", "-1");
  row.setAttribute("data-kbd-row", "");
  row.focus({ preventScroll: true });
  row.scrollIntoView({ block: "nearest" });
}

const label = (el: HTMLElement) =>
  `${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("title") ?? ""} ${el.textContent ?? ""}`.trim();

/** Press what "open" means for this row. Returns false when nothing fits. */
export function openRow(row: HTMLTableRowElement): boolean {
  const explicit = row.querySelector<HTMLElement>("[data-row-open]");
  if (explicit) {
    explicit.click();
    return true;
  }
  const controls = Array.from(row.querySelectorAll<HTMLElement>("button, a[href]")).filter(
    (el) => visible(el) && !(el as HTMLButtonElement).disabled,
  );
  const find = (re: RegExp) => controls.find((el) => re.test(label(el)) && !/delete|remove|trash/i.test(label(el)));
  const details = find(/\b(view|details?|open|receipt|history|statement|payslip)\b/i);
  if (details) {
    details.click();
    return true;
  }
  if (row.classList.contains("cursor-pointer")) {
    row.click();
    return true;
  }
  const edit = find(/\bedit\b/i);
  if (edit) {
    edit.click();
    return true;
  }
  return false;
}
