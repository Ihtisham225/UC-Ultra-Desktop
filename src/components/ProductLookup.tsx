import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, PackageSearch, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatQty } from "@/lib/format";
import { CHALLAN_KIND, type ChallanKindValue } from "@/lib/handicraft";
import { rpc } from "@/lib/apiClient";
import type { ChallanProductDto, ChallanProductDetailDto } from "@/lib/handicraftTypes";

/** The screen's date / party / status filters, as the action takes them. */
export interface ProductFilters {
  from?: string | null;
  to?: string | null;
  supplier_id?: string | null;
  status?: "open" | "closed" | null;
  kind?: ChallanKindValue | null;
}

const wt = (n: number) => Number(n.toFixed(3)).toLocaleString();

/**
 * Find one product across the challans.
 *
 * A craft shop keeps no catalogue — a product is only ever the تفصیل typed on
 * a challan line — so the shop's own question ("where are my 300 black
 * shawls?") can't be answered from a product record. This groups the lines by
 * that text and shows, for one of them, how much went out, how much came back
 * and which challans still owe the rest.
 *
 * It reads the page's own filters, so the figures always describe the same set
 * of challans the list below is showing.
 */
export function ProductLookup({
  kind,
  filters,
  value,
  onChange,
}: {
  kind: ChallanKindValue;
  /** The screen's date / party / status filters. Must be memoized by the caller. */
  filters: ProductFilters;
  /** Normalized key of the chosen product, or "" for none. */
  value: string;
  onChange: (key: string) => void;
}) {
  const copy = CHALLAN_KIND[kind];
  const making = kind === "making";
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<ChallanProductDto[]>([]);
  const [detail, setDetail] = useState<ChallanProductDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  // Shown beside the picker rather than raised as a toast: the screen loads
  // its challans off the same trip, and has already said so if that failed.
  const [listFailed, setListFailed] = useState(false);

  useEffect(() => {
    let live = true;
    rpc<ChallanProductDto[]>("listChallanProductsAction", filters)
      .then((rows) => { if (!live) return; setProducts(rows); setListFailed(false); })
      .catch(() => { if (live) setListFailed(true); });
    return () => { live = false; };
  }, [filters]);

  const loadDetail = useCallback(async () => {
    if (!value) { setDetail(null); return; }
    setLoading(true);
    try {
      const row = await rpc<ChallanProductDetailDto | null>("getChallanProductAction", value, filters);
      setDetail(row);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load the product");
    }
    setLoading(false);
  }, [value, filters]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const selected = products.find((p) => p.key === value);

  return (
    <div className="space-y-3">
      <Card className="shadow-card p-4 flex flex-wrap items-end gap-2">
        <div className="space-y-1.5 min-w-0 flex-1 sm:max-w-md">
          <Label className="text-xs">Find a product (تفصیل)</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between font-normal"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <PackageSearch className="size-4 opacity-60 shrink-0" />
                  <span className={`truncate ${selected || detail ? "" : "text-muted-foreground"}`}>
                    {selected?.description ?? detail?.description ?? "Search what was sent…"}
                  </span>
                </span>
                <ChevronsUpDown className="size-4 opacity-50 shrink-0 ms-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-72" align="start">
              <Command
                filter={(itemValue, search) =>
                  itemValue.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0
                }
              >
                <CommandInput placeholder="Type any part of the detail…" />
                <CommandList>
                  <CommandEmpty>Nothing sent by that name.</CommandEmpty>
                  <CommandGroup>
                    {products.map((p) => (
                      <CommandItem
                        key={p.key}
                        value={p.description}
                        onSelect={() => { onChange(p.key); setOpen(false); }}
                      >
                        <Check className={`size-4 me-2 shrink-0 ${value === p.key ? "opacity-100" : "opacity-0"}`} />
                        <span className="truncate">{p.description}</span>
                        <span className="ms-auto shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                          {formatQty(p.sent)} sent
                          {p.outstanding > 0 ? ` · ${formatQty(p.outstanding)} left` : " · all back"}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        {value && (
          <Button variant="ghost" onClick={() => onChange("")}>
            <X className="size-4 me-1.5" /> Clear product
          </Button>
        )}
        {listFailed ? (
          <p className="text-xs text-destructive pb-2.5">
            Couldn’t load the product list — this needs a connection.
          </p>
        ) : products.length > 0 && !value ? (
          <p className="text-xs text-muted-foreground pb-2.5">
            {products.length} product{products.length === 1 ? "" : "s"} on these challans
          </p>
        ) : null}
      </Card>

      {value && (
        <Card className="shadow-card overflow-hidden border-primary/40">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : !detail ? (
            <div className="p-8 text-center text-muted-foreground">
              Nothing matches that product in this date range. Clear the filters to see every challan.
            </div>
          ) : (
            <>
              <div className="p-4 border-b">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold">{detail.description}</h2>
                  <p className="text-xs text-muted-foreground">
                    {detail.challans_count} challan{detail.challans_count === 1 ? "" : "s"} ·{" "}
                    {detail.parties_count} {detail.parties_count === 1 ? copy.party.toLowerCase() : copy.partyPlural.toLowerCase()} ·{" "}
                    {detail.open_challans} still open · last sent {detail.last_date}
                  </p>
                </div>
                <div className="grid gap-3 mt-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Sent</div>
                    <div className="text-xl font-bold mt-1">{formatQty(detail.sent)}</div>
                    {detail.sent_weight > 0 && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">{wt(detail.sent_weight)} weight</div>
                    )}
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Received back</div>
                    <div className="text-xl font-bold mt-1 text-success">{formatQty(detail.received)}</div>
                    {detail.received_weight > 0 && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">{wt(detail.received_weight)} weight</div>
                    )}
                  </div>
                  <div className="rounded-lg border p-3 border-primary/40">
                    <div className="text-xs text-muted-foreground">Still with the {copy.partyPlural.toLowerCase()}</div>
                    <div className={`text-xl font-bold mt-1 ${detail.outstanding > 0 ? "text-primary" : "text-muted-foreground"}`}>
                      {formatQty(detail.outstanding)}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">sent minus everything settled</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Short / damaged</div>
                    <div className="text-xl font-bold mt-1">
                      {formatQty(detail.short)} / {formatQty(detail.damaged)}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">written off the pending count</div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Challan</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>{copy.party}</TableHead>
                      <TableHead className="text-end">Sent</TableHead>
                      <TableHead className="text-end">Back</TableHead>
                      <TableHead className="text-end">Short</TableHead>
                      <TableHead className="text-end">Damaged</TableHead>
                      <TableHead className="text-end">Left</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.challans.map((c) => (
                      <TableRow key={c.challan_id}>
                        <TableCell className="whitespace-nowrap">
                          <span className="font-medium">#{c.number}</span>
                          {c.book_number && (
                            <span className="text-xs text-muted-foreground ms-1.5">bk {c.book_number}</span>
                          )}
                          {c.bills.length > 0 && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {c.bills.map((b) => `#${b.number} (${b.date}): ${formatQty(b.received)}`).join(" · ")}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{c.date}</TableCell>
                        <TableCell className="font-medium">{c.supplier_name}</TableCell>
                        <TableCell className="text-end">{formatQty(c.sent)}</TableCell>
                        <TableCell className="text-end text-success">{formatQty(c.received)}</TableCell>
                        <TableCell className="text-end text-muted-foreground">{c.short > 0 ? formatQty(c.short) : "—"}</TableCell>
                        <TableCell className="text-end text-muted-foreground">{c.damaged > 0 ? formatQty(c.damaged) : "—"}</TableCell>
                        <TableCell className={`text-end font-semibold ${c.outstanding > 0 ? "text-primary" : "text-muted-foreground"}`}>
                          {formatQty(c.outstanding)}
                        </TableCell>
                        <TableCell>
                          <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-bold ${c.status === "open" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {c.status === "open" ? (making ? "Running" : "At company") : "Finished"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="px-4 py-2.5 border-t text-xs text-muted-foreground">
                A bill is settled against the challan it came off, so what is left is counted
                challan by challan.{" "}
                {making
                  ? "A making challan can record boxes going out and pieces coming back — “left” only reads true where both are written the same way."
                  : "All figures are pieces."}
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
