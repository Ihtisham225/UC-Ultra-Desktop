/**
 * The "Category / Brand" pair every product-based report (and the purchase
 * form's product picker) narrows by. Picking a parent category takes its
 * sub-categories too — the rule lives in lib/sales-report::catalogMatcher.
 *
 * ⚠️ COPIED verbatim to the desktop (minus "use client") — change both.
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FilterPicker } from "@/components/reports/SalesReportView";
import {
  catalogMatcher,
  catalogOptions,
  EMPTY_CATALOG_FILTER,
  isCatalogFiltered,
  type CatalogBrand,
  type CatalogCategory,
  type CatalogFilter,
  type CatalogTagged,
} from "@/lib/sales-report";

export function useCatalogFilter(items: CatalogTagged[], categories: CatalogCategory[], brands: CatalogBrand[]) {
  const [filter, setFilter] = useState<CatalogFilter>(EMPTY_CATALOG_FILTER);
  const options = useMemo(() => catalogOptions(items, categories, brands), [items, categories, brands]);
  const match = useMemo(() => catalogMatcher(filter, categories, brands), [filter, categories, brands]);
  const label = [
    filter.category && options.categories.find((o) => o.value === filter.category)?.label,
    filter.brand && options.brands.find((o) => o.value === filter.brand)?.label,
  ].filter(Boolean).join(" · ");
  return { filter, setFilter, options, match, filtered: isCatalogFiltered(filter), label };
}

/** Loads the category / brand lists once; no loader (an older host) = empty lists, no filter shown. */
export function useCatalogLists(load?: () => Promise<{ categories: CatalogCategory[]; brands: CatalogBrand[] }>) {
  const [lists, setLists] = useState<{ categories: CatalogCategory[]; brands: CatalogBrand[] }>({ categories: [], brands: [] });
  useEffect(() => {
    if (!load) return;
    let live = true;
    load().then((l) => { if (live) setLists(l); }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return lists;
}

export type CatalogFilterState = ReturnType<typeof useCatalogFilter>;

/** The two pickers (and "Clear"), for a filter from `useCatalogFilter`. */
export function CatalogFilterBar({ state }: { state: CatalogFilterState }) {
  const { filter, setFilter, options, filtered } = state;
  return (
    <>
      <FilterPicker
        label="Category"
        all="All categories"
        value={filter.category}
        options={options.categories}
        onChange={(category) => setFilter((f) => ({ ...f, category }))}
      />
      <FilterPicker
        label="Brand"
        all="All brands"
        value={filter.brand}
        options={options.brands}
        onChange={(brand) => setFilter((f) => ({ ...f, brand }))}
      />
      {filtered && (
        <Button size="sm" variant="ghost" className="h-9 self-end" onClick={() => setFilter(EMPTY_CATALOG_FILTER)}>
          Clear
        </Button>
      )}
    </>
  );
}
