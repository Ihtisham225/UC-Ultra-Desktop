/**
 * The shop's own sidebar order (Settings → Shop → Menu): which group comes
 * first, and the order of the pages inside each group. Saved on the shop
 * (shops.nav_order), so the owner sets it once for everyone who works there.
 *
 * Only ORDER is customised — what each person may open still comes from
 * lib/app-nav, so reordering can never show a cashier a page they can't use.
 * Pages are matched by their path, which never changes when a label is
 * translated or renamed.
 *
 * Pure. ⚠️ COPIED verbatim to the desktop (`src/lib/nav-order.ts`).
 */

import { NAV_SECTION_ORDER, type NavPage, type NavSection } from "@/lib/app-nav";

export interface NavOrder {
  sections: NavSection[];
  /** Page paths, per group, in the order they should appear. */
  pages: Partial<Record<NavSection, string[]>>;
}

export interface NavGroup {
  section: NavSection;
  items: NavPage[];
}

const SECTIONS = new Set<string>(NAV_SECTION_ORDER);

/** A stored value made safe to use: unknown groups and junk are dropped. Null = the default order. */
export function normalizeNavOrder(raw: unknown): NavOrder | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { sections?: unknown; pages?: unknown };
  const sections = Array.isArray(r.sections)
    ? [...new Set(r.sections.filter((s): s is NavSection => typeof s === "string" && SECTIONS.has(s)))]
    : [];
  const pages: NavOrder["pages"] = {};
  if (r.pages && typeof r.pages === "object") {
    for (const [section, list] of Object.entries(r.pages as Record<string, unknown>)) {
      if (!SECTIONS.has(section) || !Array.isArray(list)) continue;
      pages[section as NavSection] = [...new Set(list.filter((p): p is string => typeof p === "string" && p.startsWith("/")))];
    }
  }
  if (sections.length === 0 && Object.keys(pages).length === 0) return null;
  return { sections, pages };
}

/**
 * The sidebar's groups in the shop's order. Anything the saved order doesn't
 * mention — a group or page added later, or one switched on after the order
 * was saved — keeps its default place after the ones that were arranged.
 */
export function orderedNav(pages: NavPage[], order: NavOrder | null): NavGroup[] {
  const sectionRank = (s: NavSection) => {
    const i = order?.sections.indexOf(s) ?? -1;
    return i === -1 ? 1000 + NAV_SECTION_ORDER.indexOf(s) : i;
  };
  const sections = [...NAV_SECTION_ORDER].sort((a, b) => sectionRank(a) - sectionRank(b));
  return sections
    .map((section) => {
      const saved = order?.pages[section] ?? [];
      const defaults = pages.filter((p) => p.section === section);
      const rank = (p: NavPage) => {
        const i = saved.indexOf(p.to);
        return i === -1 ? 1000 + defaults.indexOf(p) : i;
      };
      return { section, items: [...defaults].sort((a, b) => rank(a) - rank(b)) };
    })
    .filter((g) => g.items.length > 0);
}

/** What the editor saves: every group, and every page it showed, in on-screen order. */
export function navOrderFrom(groups: NavGroup[]): NavOrder {
  const shown = groups.map((g) => g.section);
  return {
    sections: [...shown, ...NAV_SECTION_ORDER.filter((s) => !shown.includes(s))],
    pages: Object.fromEntries(groups.map((g) => [g.section, g.items.map((p) => p.to)])),
  };
}

/** A copy of `list` with the item at `from` moved to `to`. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
