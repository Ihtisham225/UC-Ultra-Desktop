/**
 * Does a product match what was typed into a product search box?
 *
 * Names are matched loosely — every word typed must appear somewhere in the
 * name (or generic name / variant name), in any order. Codes (barcode, SKU)
 * are matched from their START only. Matching a code anywhere inside it made
 * "3119" find "3001 BT Polyster", whose barcode 806311939900 happens to hold
 * those four digits (SHAMSHER CORPORATION, 2026-11-24): a person typing digits
 * is either typing a product's number or scanning its whole barcode, never a
 * slice out of the middle of someone else's.
 *
 * Pure. ⚠️ COPIED verbatim to the desktop — change both.
 */

export interface SearchableVariant {
  name?: string | null;
  sku?: string | null;
  barcode?: string | null;
}

export interface SearchableProduct {
  name: string;
  generic_name?: string | null;
  sku?: string | null;
  barcode?: string | null;
  variants?: SearchableVariant[] | null;
}

/** Lower-cased words of a search, empty when nothing was typed. */
export function searchWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

const hasAll = (text: string | null | undefined, words: string[]) => {
  if (!text) return false;
  const t = text.toLowerCase();
  return words.every((w) => t.includes(w));
};

/** A barcode / SKU matches when it STARTS with what was typed. */
export function codeMatches(code: string | null | undefined, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!code || !q) return false;
  return code.trim().toLowerCase().startsWith(q);
}

export function productMatchesSearch(p: SearchableProduct, query: string): boolean {
  const words = searchWords(query);
  if (words.length === 0) return true;
  const name = p.name ?? "";
  if (hasAll(name, words) || hasAll(p.generic_name, words)) return true;
  if (codeMatches(p.barcode, query) || codeMatches(p.sku, query)) return true;
  return (p.variants ?? []).some(
    (v) =>
      // "Shirt Large" — product words and variant words together.
      hasAll(`${name} ${v.name ?? ""}`, words) ||
      codeMatches(v.barcode, query) ||
      codeMatches(v.sku, query),
  );
}

/**
 * Exact code hits first (a full barcode scan must land on its product even
 * when its name also contains the digits of another's), then name matches
 * in the list's own order.
 */
export function searchProducts<P extends SearchableProduct>(list: P[], query: string): P[] {
  if (searchWords(query).length === 0) return list;
  const q = query.trim().toLowerCase();
  const exact = (c: string | null | undefined) => !!c && c.trim().toLowerCase() === q;
  const hits = list.filter((p) => productMatchesSearch(p, query));
  const isExact = (p: P) =>
    exact(p.barcode) || exact(p.sku) || (p.variants ?? []).some((v) => exact(v.barcode) || exact(v.sku));
  return [...hits.filter(isExact), ...hits.filter((p) => !isExact(p))];
}
