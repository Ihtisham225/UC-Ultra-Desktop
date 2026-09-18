/**
 * Shelves and racks — where goods are kept.
 *
 * A tree of places (an area such as the godown, a rack in it, a shelf on the
 * rack). Products and variants point at one place. It is a LABEL: stock is not
 * split between places, so nothing that moves stock needs to know about it.
 *
 * Pure, so the web, the terminal's offline store and the tests all name a place
 * the same way. A copy of the web app's `src/lib/storage-locations.ts` —
 * keep the two in step.
 */

export type LocationKind = "area" | "rack" | "shelf";

export const LOCATION_KINDS: { value: LocationKind; label: string; hint: string }[] = [
  { value: "area", label: "Area", hint: "A room or the godown" },
  { value: "rack", label: "Rack", hint: "A rack or cupboard" },
  { value: "shelf", label: "Shelf", hint: "A shelf, drawer or bin" },
];

export interface LocationRow {
  id: string;
  parent_id: string | null;
  name: string;
  kind: string;
  sort_order?: number | null;
}

export interface LocationNode<T extends LocationRow = LocationRow> {
  row: T;
  depth: number;
  children: LocationNode<T>[];
}

const byOrder = (a: LocationRow, b: LocationRow) =>
  (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, undefined, { numeric: true });

/**
 * The places as a tree. A row whose parent is missing (deleted on another
 * terminal, not yet pruned here) is shown at the top rather than lost.
 */
export function buildLocationTree<T extends LocationRow>(rows: T[]): LocationNode<T>[] {
  const ids = new Set(rows.map((r) => r.id));
  const kids = new Map<string | null, T[]>();
  for (const r of rows) {
    const parent = r.parent_id && ids.has(r.parent_id) ? r.parent_id : null;
    kids.set(parent, [...(kids.get(parent) ?? []), r]);
  }
  const walk = (parent: string | null, depth: number, seen: Set<string>): LocationNode<T>[] =>
    [...(kids.get(parent) ?? [])].sort(byOrder).flatMap((row) => {
      // A cycle can only come from bad data, but it must not hang the page.
      if (seen.has(row.id)) return [];
      const next = new Set(seen).add(row.id);
      return [{ row, depth, children: walk(row.id, depth + 1, next) }];
    });
  return walk(null, 0, new Set());
}

/** Every place in tree order, each with its depth — for a dropdown. */
export function flattenLocations<T extends LocationRow>(rows: T[]): { row: T; depth: number }[] {
  const out: { row: T; depth: number }[] = [];
  const visit = (nodes: LocationNode<T>[]) => {
    for (const n of nodes) {
      out.push({ row: n.row, depth: n.depth });
      visit(n.children);
    }
  };
  visit(buildLocationTree(rows));
  return out;
}

/** "Godown › Rack A › Shelf 3" — the whole way to a place. */
export function locationPath(id: string | null | undefined, rows: LocationRow[], sep = " › "): string | null {
  if (!id) return null;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const names: string[] = [];
  let at = byId.get(id);
  const seen = new Set<string>();
  while (at && !seen.has(at.id)) {
    seen.add(at.id);
    names.unshift(at.name);
    at = at.parent_id ? byId.get(at.parent_id) : undefined;
  }
  return names.length ? names.join(sep) : null;
}

/** A place and everything inside it — filtering by a rack includes its shelves. */
export function locationAndDescendants(id: string, rows: LocationRow[]): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of rows) {
      if (r.parent_id && out.has(r.parent_id) && !out.has(r.id)) {
        out.add(r.id);
        grew = true;
      }
    }
  }
  return out;
}

/**
 * Where a sellable thing is: the variant's own place when it has one, else the
 * product's. The old free-text label (pharmacies had one) is the last resort,
 * so nothing a shop already typed disappears before it's converted.
 */
export function whereKept(
  product: { location_id?: string | null; shelf_location?: string | null },
  variant: { location_id?: string | null } | null | undefined,
  rows: LocationRow[],
): string | null {
  return (
    locationPath(variant?.location_id, rows) ??
    locationPath(product.location_id, rows) ??
    (product.shelf_location?.trim() || null)
  );
}
