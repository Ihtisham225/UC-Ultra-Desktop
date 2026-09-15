/**
 * "Add new" hand-off between the Ctrl/Cmd+E popup and the page that owns the form.
 *
 * The forms stay where they live. A page registers a handler per thing it can
 * create (`useAddNew({ product: () => setEditing(blank) })`); the popup then
 * either calls that handler — the page is already open — or navigates to the
 * page with `?new=<id>`, and the page runs the handler once it has mounted.
 *
 * Module state rather than context: the popup sits in the layout and the pages
 * below it, and a page registering must not re-render the layout.
 *
 * A copy of the web app's `src/lib/add-new.ts` — keep the two in step.
 */

export const NEW_PARAM = "new";

type Handler = () => void;

const handlers = new Map<string, Handler>();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

/** Register a page's handlers; returns the function that removes them again. */
export function registerAddNew(entries: Record<string, Handler>): () => void {
  const ids = Object.keys(entries);
  for (const id of ids) handlers.set(id, entries[id]);
  notify();
  return () => {
    // Only remove what is still ours — a page that remounted may have put its
    // own handler back under the same id before this cleanup ran.
    for (const id of ids) if (handlers.get(id) === entries[id]) handlers.delete(id);
    notify();
  };
}

/** Run the handler for `id` if the page that owns it is on screen. */
export function runAddNew(id: string): boolean {
  const h = handlers.get(id);
  if (!h) return false;
  h();
  return true;
}

/** Ids whose page is on screen right now — the popup lists these first. */
export const registeredAddNew = () => [...handlers.keys()];

export function subscribeAddNew(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
