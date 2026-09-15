/**
 * The pages this person opened last, newest first — the top of the Go to popup,
 * so going back to where you were is Ctrl/Cmd+G, Enter.
 *
 * Per browser (localStorage), and only ever read after mount.
 */

const KEY = "ucu.recentPages";
const MAX = 6;

export function readRecentPages(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

export function pushRecentPage(path: string) {
  try {
    const next = [path, ...readRecentPages().filter((p) => p !== path)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private window or storage blocked — recents are a convenience */
  }
}

/** The nav entry a path belongs to: "/payroll/abc" → "/payroll". */
export function pageFor(path: string, pages: readonly string[]): string | null {
  let best: string | null = null;
  for (const to of pages) {
    if (path === to || path.startsWith(`${to}/`)) {
      if (!best || to.length > best.length) best = to;
    }
  }
  return best;
}
