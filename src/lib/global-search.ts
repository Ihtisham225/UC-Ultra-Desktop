/**
 * The header's search: which groups it shows, in what order, which pages
 * match, and where each hit lands.
 *
 * ⚠️ Pure and COPIED verbatim to the desktop (pinned by its
 * src/test/global-search.test.ts) — change both. The records themselves come
 * from `globalSearchAction` (app/(app)/search-actions.ts), which the desktop
 * reads over RPC.
 */

export type SearchHitType =
  | "page"
  | "product" | "category" | "brand" | "sale" | "customer" | "supplier"
  | "vehicle" | "oil_change" | "purchase" | "return" | "expense" | "ledger" | "patient";

export interface SearchHit {
  type: SearchHitType;
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  /** What the landing needs when it isn't the id (a plate, a day, a name, a route). */
  link?: string;
}

/** Groups top to bottom: pages first, then the records a counter looks up most. */
export const GROUP_ORDER: SearchHitType[] = [
  "page",
  "vehicle", "oil_change",
  "customer", "sale", "product", "category", "brand",
  "supplier", "ledger", "purchase", "return", "expense", "patient",
];

interface PageLike {
  to: string;
  label: string;
  section?: string;
  keywords?: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Sidebar pages whose name or keywords match what was typed — every word must
 * appear somewhere, so "oil ch" finds Oil Changes. At most `limit`, the ones
 * whose NAME starts with the text first.
 */
export function matchPages(pages: PageLike[], query: string, limit = 5): SearchHit[] {
  const q = norm(query);
  if (!q) return [];
  const words = q.split(" ");
  const seen = new Set<string>();
  const hits: { hit: SearchHit; rank: number }[] = [];
  for (const p of pages) {
    if (seen.has(p.to)) continue;
    const label = norm(p.label);
    const hay = [label, ...(p.keywords ?? []).map(norm)].join(" | ");
    if (!words.every((w) => hay.includes(w))) continue;
    seen.add(p.to);
    hits.push({
      rank: label.startsWith(q) ? 0 : label.includes(q) ? 1 : 2,
      hit: { type: "page", id: p.to, title: p.label, subtitle: p.section ? `Go to · ${p.section}` : "Go to", link: p.to },
    });
  }
  return hits.sort((a, b) => a.rank - b.rank).slice(0, limit).map((h) => h.hit);
}

const q = (v: string) => encodeURIComponent(v);

/** Where clicking a hit goes. Each page reads its own param after mount. */
export function searchTarget(r: SearchHit): string {
  switch (r.type) {
    case "page": return r.link ?? r.id;
    case "product": return `/products?q=${q(r.title)}`;
    case "category": return `/products?category=${r.id}`;
    case "brand": return `/products?brand=${r.id}`;
    case "customer": return `/customers?q=${q(r.title)}`;
    case "supplier": return `/suppliers?q=${q(r.title)}`;
    case "sale": return `/sales?sale=${r.id}`;
    case "vehicle": return `/vehicles?vehicle=${r.id}`;
    case "oil_change": return `/oil-changes?q=${q(r.link ?? r.title)}`;
    case "purchase": return `/purchases?purchase=${r.id}`;
    case "return": return `/returns?return=${r.id}`;
    case "expense": return r.link ? `/expenses?day=${r.link}` : "/expenses";
    case "ledger": return `/debts?q=${q(r.link ?? r.title)}`;
    case "patient": return `/patients?q=${q(r.title)}`;
  }
}
