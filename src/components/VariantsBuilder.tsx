import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Sparkles, Layers, ChevronDown, ChevronUp, Tag } from "lucide-react";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { useShop } from "@/contexts/ShopContext";

/**
 * Public shape used by the parent (Products page).
 * The parent already knows how to persist these — we just hand them back.
 */
export interface BuilderVariant {
  id?: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price_override: number | null;
  stock: number;
  _new?: boolean;
}

export interface AttributeGroup {
  /** Display name, e.g. "Size", "Color" */
  name: string;
  /** Raw (trimmed, deduped) values, e.g. ["S", "M", "L"] */
  values: string[];
}

interface Props {
  /** Parent product name — used to suggest attribute combinations like "Red / S". */
  productName: string;
  /** Parent product base price — shown as the fallback when override is empty. */
  basePrice: number;
  /** Existing variants when editing. */
  value: BuilderVariant[];
  onChange: (variants: BuilderVariant[]) => void;
}

const SEPARATOR = " / ";

/** Reverse-engineer attribute groups from a flat list of variant names like "Red / S". */
const parseGroupsFromVariants = (variants: BuilderVariant[]): AttributeGroup[] => {
  if (variants.length === 0) return [];
  const rows = variants
    .map((v) => v.name.split(SEPARATOR).map((s) => s.trim()).filter(Boolean))
    .filter((r) => r.length > 0);
  if (rows.length === 0) return [];
  const cols = Math.max(...rows.map((r) => r.length));
  const groups: AttributeGroup[] = [];
  for (let i = 0; i < cols; i++) {
    const seen = new Set<string>();
    const values: string[] = [];
    rows.forEach((r) => {
      const v = r[i];
      if (v && !seen.has(v)) { seen.add(v); values.push(v); }
    });
    groups.push({ name: cols === 1 ? "Option" : `Option ${i + 1}`, values });
  }
  return groups;
};

/** All attribute combinations as ordered name strings. */
const cartesian = (groups: AttributeGroup[]): string[] => {
  const cleaned = groups
    .map((g) => g.values.map((v) => v.trim()).filter(Boolean))
    .filter((arr) => arr.length > 0);
  if (cleaned.length === 0) return [];
  return cleaned.reduce<string[]>(
    (acc, vals) => acc.flatMap((prefix) => vals.map((v) => (prefix ? prefix + SEPARATOR + v : v))),
    [""],
  ).filter(Boolean);
};

export const VariantsBuilder = ({ productName, basePrice, value, onChange }: Props) => {
  const { t } = useTranslation();
  const formatMoney = useFormatMoney();
  const { currentShop } = useShop();
  const cur = currentShop?.currency ?? "USD";

  const [groups, setGroups] = useState<AttributeGroup[]>(() => {
    const parsed = parseGroupsFromVariants(value);
    return parsed.length > 0 ? parsed : [{ name: "Size", values: [] }];
  });
  const [pendingValue, setPendingValue] = useState<Record<number, string>>({});
  const [open, setOpen] = useState(true);

  // Re-seed groups when the parent swaps to a different product.
  useEffect(() => {
    const parsed = parseGroupsFromVariants(value);
    if (parsed.length > 0) setGroups(parsed);
    // intentional: only when value identity changes wholesale (e.g. switching products)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value === undefined]);

  const previewNames = useMemo(() => cartesian(groups), [groups]);

  /** Merge generated combinations with current variants, keeping any user edits (price_override). */
  const generate = () => {
    const names = cartesian(groups);
    if (names.length === 0) return;
    const byName = new Map(value.map((v) => [v.name, v]));
    const next: BuilderVariant[] = names.map((name) => {
      const existing = byName.get(name);
      if (existing) return existing;
      return {
        name,
        sku: null,        // auto-generated on save
        barcode: null,    // auto-generated on save
        price_override: null,
        stock: 0,
        _new: true,
      };
    });
    onChange(next);
  };

  const addGroup = () => setGroups((g) => [...g, { name: `Option ${g.length + 1}`, values: [] }]);
  const removeGroup = (i: number) => setGroups((g) => g.filter((_, idx) => idx !== i));
  const updateGroupName = (i: number, name: string) =>
    setGroups((g) => g.map((x, idx) => (idx === i ? { ...x, name } : x)));

  const addValue = (i: number, raw: string) => {
    const parts = raw
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setGroups((g) =>
      g.map((x, idx) => {
        if (idx !== i) return x;
        const seen = new Set(x.values.map((v) => v.toLowerCase()));
        const additions = parts.filter((p) => !seen.has(p.toLowerCase()));
        return { ...x, values: [...x.values, ...additions] };
      }),
    );
    setPendingValue((p) => ({ ...p, [i]: "" }));
  };

  const removeValue = (i: number, val: string) =>
    setGroups((g) => g.map((x, idx) => (idx === i ? { ...x, values: x.values.filter((v) => v !== val) } : x)));

  const updateVariantPrice = (idx: number, raw: string) => {
    const next = [...value];
    next[idx] = {
      ...next[idx],
      price_override: raw === "" ? null : parseFloat(raw),
    };
    onChange(next);
  };

  const removeVariant = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  const setAllPrices = (price: number | null) => {
    onChange(value.map((v) => ({ ...v, price_override: price })));
  };

  const totalCombos = previewNames.length;
  const groupsReady = groups.every((g) => g.values.length > 0) && groups.length > 0;

  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/[0.02] to-transparent overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 p-3.5 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-9 rounded-lg bg-primary/10 grid place-items-center shrink-0">
            <Layers className="size-4 text-primary" />
          </div>
          <div className="min-w-0 text-start">
            <div className="font-semibold text-sm">{t("variantsBuilder.title")}</div>
            <div className="text-xs text-muted-foreground truncate">
              {value.length > 0
                ? t("variantsBuilder.summary", { count: value.length })
                : t("variantsBuilder.emptyHelp")}
            </div>
          </div>
        </div>
        {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t p-4 space-y-5">
          {/* STEP 1: Define attribute groups */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("variantsBuilder.step1")}
              </Label>
              <Button type="button" variant="ghost" size="sm" onClick={addGroup} className="h-7">
                <Plus className="size-3.5 me-1" /> {t("variantsBuilder.addOption")}
              </Button>
            </div>

            <div className="space-y-2.5">
              {groups.map((g, i) => (
                <div key={i} className="rounded-lg border bg-card p-3 space-y-2.5">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 min-w-0 space-y-1">
                      <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Tag className="size-3 shrink-0" />
                        {t("variantsBuilder.optionNameLabel")}
                      </Label>
                      <Input
                        value={g.name}
                        onChange={(e) => updateGroupName(i, e.target.value)}
                        placeholder={t("variantsBuilder.optionNamePlaceholder")}
                        className="h-8 text-sm font-medium"
                      />
                    </div>
                    {groups.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        onClick={() => removeGroup(i)}
                        title={t("variantsBuilder.removeOption")}
                      >
                        <X className="size-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{t("variantsBuilder.valuesLabel")}</Label>
                    {g.values.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {g.values.map((v) => (
                          <Badge
                            key={v}
                            variant="secondary"
                            className="gap-1 pe-1 py-1 font-normal"
                          >
                            {v}
                            <button
                              type="button"
                              onClick={() => removeValue(i, v)}
                              className="hover:text-destructive"
                              aria-label={t("common.delete")}
                            >
                              <X className="size-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <Input
                      value={pendingValue[i] ?? ""}
                      onChange={(e) => setPendingValue((p) => ({ ...p, [i]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addValue(i, pendingValue[i] ?? "");
                        }
                      }}
                      onBlur={() => addValue(i, pendingValue[i] ?? "")}
                      placeholder={t("variantsBuilder.valuePlaceholder")}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* STEP 2: Generate */}
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground min-w-0">
              {groupsReady
                ? t("variantsBuilder.willGenerate", { count: totalCombos })
                : t("variantsBuilder.addValuesFirst")}
            </div>
            <Button
              type="button"
              size="sm"
              disabled={!groupsReady}
              onClick={generate}
              className="bg-gradient-primary text-primary-foreground hover:opacity-90 shrink-0"
            >
              <Sparkles className="size-3.5 me-1" />
              {value.length > 0 ? t("variantsBuilder.regenerate") : t("variantsBuilder.generate")}
            </Button>
          </div>

          {/* STEP 3: Per-variant price overrides */}
          {value.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("variantsBuilder.step3", { count: value.length })}
                </Label>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAllPrices(null)}>
                    {t("variantsBuilder.useBaseAll")}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <div className="grid grid-cols-[1fr_140px_36px] gap-2 px-3 py-2 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <div>{t("variantsBuilder.variantCol")}</div>
                  <div>{t("variantsBuilder.priceCol")}</div>
                  <div></div>
                </div>
                <div className="divide-y max-h-[280px] overflow-y-auto">
                  {value.map((v, idx) => (
                    <div key={(v.id ?? "new") + idx} className="grid grid-cols-[1fr_140px_36px] gap-2 px-3 py-2 items-center hover:bg-muted/30">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{v.name}</div>
                        {productName && (
                          <div className="text-[11px] text-muted-foreground truncate">{productName}</div>
                        )}
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={v.price_override ?? ""}
                        placeholder={formatMoney(basePrice || 0, cur)}
                        onChange={(e) => updateVariantPrice(idx, e.target.value)}
                        className="h-8 text-sm tabular-nums"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => removeVariant(idx)}
                        title={t("common.delete")}
                      >
                        <X className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("variantsBuilder.priceHint", { base: formatMoney(basePrice || 0, cur) })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};