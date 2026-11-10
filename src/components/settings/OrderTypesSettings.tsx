/**
 * Settings → Shop → "Till order types": which order types the till offers and
 * what each is called (lib/order-types). Every store type.
 *
 * ⚠️ COPIED verbatim to the desktop (minus "use client") — change both.
 */

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { newCustomKey, OIL_CHANGE_KEY, ORDER_TYPE_HINTS, type OrderTypeSetting } from "@/lib/order-types";

export function OrderTypesSettings({
  value,
  onChange,
  disabled,
}: {
  value: OrderTypeSetting[];
  onChange: (next: OrderTypeSetting[]) => void;
  disabled?: boolean;
}) {
  const set = (key: string, patch: Partial<OrderTypeSetting>) =>
    onChange(value.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  const customs = value.filter((t) => t.custom).length;

  return (
    <div className="space-y-2">
      <div>
        <Label>Till order types</Label>
        <p className="text-xs text-muted-foreground">
          What the till asks for each sale. Switch on the ones you use and call them what your counter calls them —
          the Sales page filters and labels every bill by them. With none on, the till doesn&apos;t ask.
        </p>
      </div>
      <div className="rounded-lg border divide-y">
        {value.map((t) => (
          <div key={t.key} className="flex flex-wrap items-center gap-2 p-2 sm:flex-nowrap">
            <Switch
              checked={t.enabled}
              onCheckedChange={(v) => set(t.key, { enabled: v })}
              disabled={disabled}
              aria-label={`Offer ${t.label}`}
            />
            <div className="min-w-0 flex-1">
              <Input
                value={t.label}
                maxLength={30}
                onChange={(e) => set(t.key, { label: e.target.value })}
                disabled={disabled}
                aria-label="Label"
                placeholder={t.custom ? "e.g. Online order" : undefined}
                className="h-8"
              />
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {t.custom ? "Your own" : ORDER_TYPE_HINTS[t.key] ?? ""}
                {t.key === OIL_CHANGE_KEY && !t.enabled ? " — off hides the vehicle form at the till" : ""}
              </p>
            </div>
            {t.custom && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => onChange(value.filter((x) => x.key !== t.key))}
                disabled={disabled}
                aria-label={`Remove ${t.label || "this type"}`}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || customs >= 10}
        onClick={() => onChange([...value, { key: newCustomKey(value), label: "", enabled: true, custom: true }])}
      >
        <Plus className="size-4 mr-1.5" /> Add your own
      </Button>
    </div>
  );
}
