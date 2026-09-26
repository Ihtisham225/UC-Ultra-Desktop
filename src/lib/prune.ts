/**
 * Deciding which cached catalogue rows the server no longer has.
 *
 * The pull is incremental and upsert-only: a row deleted on the server simply
 * stops arriving, so the terminal keeps it forever. For the catalogue that was
 * a real defect, not clutter. When NIAZ OIL's products were re-imported under
 * fresh ids, every till showed each product twice — the old copy beside the
 * new — and a sale rung up against the stale card was pushed for a product id
 * the server did not have, so the real product's stock never went down.
 *
 * The server now sends the complete set of live ids with each pull, and the
 * rows it does not name are dropped. This module is only the decision, kept
 * free of IndexedDB so every rule below can be pinned by a test.
 */

interface CachedRow {
  id?: unknown;
  shop_id?: unknown;
}

/**
 * Ids of cached rows to remove.
 *
 * - ⚠️ Only rows of `shopId`. A terminal can hold more than one shop's
 *   catalogue, and the live ids describe the device token's shop alone —
 *   pruning across shops would wipe the other shop's products off the till.
 * - ⚠️ Never a row still waiting to be pushed (`keepIds`). A product created
 *   offline is not on the server yet, so it is absent from the live set by
 *   definition; dropping it would lose work the counter has not synced.
 * - Everything else not in `liveIds` is gone from the server, so it goes here.
 */
export function staleIds(
  rows: CachedRow[],
  shopId: string,
  liveIds: ReadonlySet<string>,
  keepIds: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  for (const row of rows) {
    const id = typeof row.id === "string" ? row.id : null;
    if (!id) continue;
    if (row.shop_id !== shopId) continue;
    if (liveIds.has(id) || keepIds.has(id)) continue;
    out.push(id);
  }
  return out;
}

/**
 * Ids of cached CHILD rows whose parent is gone — a purchase's lines once the
 * purchase was deleted on the server, a return's lines once the return was.
 * The server only names parent ids, so the children follow them here. Lines
 * left behind are not harmless: the till averages landed cost from its
 * purchase lines, so a deleted purchase kept moving every margin it touched.
 *
 * Same rules as `staleIds`: only this shop's rows, and never a row still
 * queued (a line whose purchase was created offline and not yet pushed).
 */
export function orphanIds(
  rows: (CachedRow & Record<string, unknown>)[],
  fkField: string,
  shopId: string,
  liveParentIds: ReadonlySet<string>,
  keepParentIds: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  for (const row of rows) {
    const id = typeof row.id === "string" ? row.id : null;
    if (!id || row.shop_id !== shopId) continue;
    const parent = typeof row[fkField] === "string" ? (row[fkField] as string) : null;
    if (!parent || liveParentIds.has(parent) || keepParentIds.has(parent)) continue;
    out.push(id);
  }
  return out;
}
