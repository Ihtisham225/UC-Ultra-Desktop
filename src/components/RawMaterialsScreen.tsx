import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Wheat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/DateInput";
import { NewRawMaterialDialog } from "@/components/NewRawMaterialDialog";
import { useShop } from "@/contexts/ShopContext";
import { usesRawMaterials } from "@/lib/cafe";
import { formatMoney, formatQty } from "@/lib/format";
import { unitLabel } from "@/lib/units";
import type { RawMaterialRow, RawMaterialsApi } from "@/lib/raw-materials";

/**
 * Raw materials (cafe shops): what the shop buys and never sells, with what
 * was bought of each in a period. Tracked ones show their stock; untracked
 * ones are costed when bought (lib/raw-materials). Buying them is an ordinary
 * purchase — this screen only lists and adds them.
 *
 * ⚠️ COPIED verbatim to the desktop; each app passes its own `api`.
 */

const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monthStart = () => { const d = new Date(); return localDay(new Date(d.getFullYear(), d.getMonth(), 1)); };
/** A local day's first and last instant, so the period means the shop's own days. */
const dayStart = (day: string) => new Date(`${day}T00:00:00`).toISOString();
const dayEnd = (day: string) => new Date(`${day}T23:59:59.999`).toISOString();

export function RawMaterialsScreen({ api, canEdit }: { api: RawMaterialsApi; canEdit: boolean }) {
  const { currentShop } = useShop();
  const money = (n: number) => formatMoney(n, currentShop?.currency ?? "PKR");

  // Dates are read after mount — today isn't knowable at render time on the server.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  useEffect(() => { setFrom(monthStart()); setTo(localDay()); }, []);

  const [rows, setRows] = useState<RawMaterialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      setRows(await api.list({ from: dayStart(from), to: dayEnd(to) }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load raw materials");
    } finally {
      setLoading(false);
    }
  }, [api, from, to]);
  useEffect(() => { void load(); }, [load]);

  const [adding, setAdding] = useState(false);

  const shown = rows.filter((r) => r.is_active);
  if (currentShop && !usesRawMaterials(currentShop)) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        Raw materials are switched off for this shop. Turn them on in Settings → Shop → Business type (cafes only).
      </div>
    );
  }
  const spent = shown.reduce((a, r) => a + r.bought_cost, 0);
  const spentUntracked = shown.filter((r) => !r.tracked).reduce((a, r) => a + r.bought_cost, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Wheat className="size-6 text-primary" /> Raw materials
          </h1>
          <p className="text-muted-foreground text-sm">
            What you buy to make things with or use in the shop, and never sell. Buy them with an ordinary purchase.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setAdding(true)} className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
            <Plus className="size-4 me-1.5" /> Add raw material
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5"><Label>From</Label><DateInput value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>To</Label><DateInput value={to} onChange={(e) => setTo(e.target.value)} /></div>
        {/* After mount only: money formats in the browser's locale, which the server can't know. */}
        {from && (
          <div className="ms-auto text-sm text-muted-foreground text-end">
            Bought for <b className="text-foreground">{money(spent)}</b>
            {spentUntracked > 0 && <> · {money(spentUntracked)} of it not tracked (counted as used)</>}
          </div>
        )}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No raw materials yet. Add one here, or turn off <b>Sold at the till</b> on a product.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-start font-medium p-3">Raw material</th>
                  <th className="text-start font-medium p-3">Quantity</th>
                  <th className="text-end font-medium p-3">In stock</th>
                  <th className="text-end font-medium p-3">Bought</th>
                  <th className="text-end font-medium p-3">Spent</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3">
                      <span className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 font-semibold ${r.tracked ? "bg-primary/10 text-primary" : "border text-muted-foreground"}`}>
                        {r.tracked ? "Tracked" : "Not tracked"}
                      </span>
                    </td>
                    <td className="p-3 text-end tabular-nums">
                      {r.stock === null ? "—" : `${formatQty(r.stock)} ${unitLabel(r.unit)}`}
                    </td>
                    <td className="p-3 text-end tabular-nums">
                      {r.bought_qty ? `${formatQty(r.bought_qty)} ${unitLabel(r.unit)}` : "—"}
                    </td>
                    <td className="p-3 text-end tabular-nums">{r.bought_cost ? money(r.bought_cost) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-muted-foreground">
        Tracked materials reach the profit report when they are used (Production, recipes, Used &amp; wasted).
        Untracked ones reach it when they are bought.
      </p>

      {adding && <NewRawMaterialDialog create={api.create} onClose={() => setAdding(false)} onCreated={() => void load()} />}
    </div>
  );
}
