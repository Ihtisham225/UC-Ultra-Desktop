/**
 * The Enter-key chain through the till.
 *
 * Every field that takes part carries `data-checkout-step="<n>"`. Enter moves to
 * the next step: steps are ordered by that number first and page order second,
 * so a field that only appears sometimes — the vehicle details once a car is
 * picked, a patient in place of a customer — slots itself in without anyone
 * maintaining a list.
 *
 * The order the counter was promised:
 *   1 customer · 2 vehicle (oil shops) · 3 discount · 4 amount · 5 account · 6 notes
 * Enter on the notes places the order.
 *
 * A step marked `data-checkout-picker` is a dropdown: arriving at it OPENS it,
 * so the counter can type to search straight away instead of pressing Enter
 * twice.
 *
 * A copy of the web app's `src/lib/checkout-keys.ts` — keep the two in step.
 */

export const STEP = {
  customer: 1,
  vehicle: 2,
  discount: 3,
  amount: 4,
  account: 5,
  notes: 6,
} as const;

/** Sort by step number, then by position on the page. Pure, so it can be tested. */
export function orderSteps<T>(items: { value: T; step: number; index: number }[]): T[] {
  return [...items]
    .filter((i) => Number.isFinite(i.step))
    .sort((a, b) => a.step - b.step || a.index - b.index)
    .map((i) => i.value);
}

const usable = (el: HTMLElement) =>
  !(el as HTMLInputElement).disabled && el.getAttribute("aria-hidden") !== "true" && el.offsetParent !== null;

/** The chain's fields inside `root`, in the order Enter walks them. */
export function stepsIn(root: ParentNode): HTMLElement[] {
  const found = Array.from(root.querySelectorAll<HTMLElement>("[data-checkout-step]"));
  return orderSteps(
    found.map((el, index) => ({ value: el, step: Number(el.dataset.checkoutStep), index })),
  ).filter(usable);
}

/** Land on a step: open it when it's a dropdown, otherwise focus and select it. */
export function focusStep(el: HTMLElement) {
  el.focus();
  if (el.dataset.checkoutPicker !== undefined) {
    el.click();
    return;
  }
  if (el instanceof HTMLInputElement) el.select();
}

/**
 * Move from `from` to the next step. Returns false when `from` was the last,
 * so the caller can decide what "past the end" means (placing the order).
 */
export function advanceFrom(from: Element, root: ParentNode = document): boolean {
  const steps = stepsIn(root);
  const current = from.closest<HTMLElement>("[data-checkout-step]") ?? (from as HTMLElement);
  const at = steps.indexOf(current);
  const next = at === -1 ? steps[0] : steps[at + 1];
  if (!next) return false;
  focusStep(next);
  return true;
}

/**
 * Focus something that React is about to render. Retries across a few frames,
 * because a line added to the cart or a dialog animating in isn't in the page
 * on the very next tick. Gives up quietly: if a product was refused for being
 * out of stock there is no line to focus, and the cursor staying in the search
 * box is exactly right.
 */
export function focusSoon(selector: string, select = true, fallback?: string) {
  let tries = 0;
  const tick = () => {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) {
      el.focus();
      if (select && el instanceof HTMLInputElement) el.select();
      return;
    }
    if (tries++ < 30) return void requestAnimationFrame(tick);
    // The thing never appeared (a line removed for want of stock): land
    // somewhere useful rather than leaving focus on nothing.
    if (fallback) focusSoon(fallback, select);
  };
  requestAnimationFrame(tick);
}
