/**
 * Shapes shared by Settings → Branches on the web and the desktop (COPIED
 * verbatim there). A "branch" is simply another store with the same owner.
 */

export interface BranchDto {
  id: string;
  name: string;
  store_type: string;
  created_at: string;
  is_current: boolean;
  /** The owner's oldest store — the only place other branches are deleted from. */
  is_first: boolean;
  products: number;
  customers: number;
  suppliers: number;
}

export interface BranchImportOptions {
  products: boolean;
  customers: boolean;
  suppliers: boolean;
}

export interface BranchImportCounts {
  products: { created: number; skipped: number };
  variants: number;
  categories: number;
  brands: number;
  customers: { created: number; merged: number; skipped: number };
  suppliers: { created: number; merged: number; skipped: number };
}

/** One line for the toast after an import. */
export function describeImport(c: BranchImportCounts, opts: BranchImportOptions): string {
  const parts: string[] = [];
  if (opts.products) {
    parts.push(`${c.products.created} products added` + (c.products.skipped ? ` (${c.products.skipped} already here)` : ""));
  }
  for (const [on, label, b] of [
    [opts.customers, "customers", c.customers],
    [opts.suppliers, "suppliers", c.suppliers],
  ] as const) {
    if (!on) continue;
    const extra = [b.merged && `${b.merged} matched existing`, b.skipped && `${b.skipped} already here`].filter(Boolean);
    parts.push(`${b.created} ${label} added` + (extra.length ? ` (${extra.join(", ")})` : ""));
  }
  return parts.join(" · ");
}
