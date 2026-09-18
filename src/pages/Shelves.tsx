import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  MapPin, Plus, Pencil, Trash2, Printer, Warehouse, LayoutGrid, Rows3, PackageSearch, ArrowRightLeft, Wand2, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ConfirmDialog";
import { LocationSelect } from "@/components/LocationSelect";
import { useShop } from "@/contexts/ShopContext";
import { useAddNew } from "@/hooks/useAddNew";
import { formatQty } from "@/lib/format";
import {
  LOCATION_KINDS, buildLocationTree, locationAndDescendants, locationPath, type LocationKind, type LocationNode,
} from "@/lib/storage-locations";
import { buildCountSheetHtml } from "@/lib/count-sheet";
import { rpc } from "@/lib/apiClient";
import { syncNow } from "@/lib/syncEngine";

/*
 * Port of the web app's Shelves page. Places are edited through the server
 * (the same actions, over /api/desktop/rpc); every change is followed by a
 * sync so the product form and the till — which read shelves from the local
 * store — see it straight away.
 */
interface StorageLocationDto {
  id: string; parent_id: string | null; name: string; kind: string; sort_order: number; notes: string | null; item_count: number;
}
interface ShelfItemDto {
  product_id: string; variant_id: string | null; name: string; sku: string | null; unit: string | null;
  stock: number; location_id: string | null; own_place: boolean;
}
interface ProductDto {
  id: string; name: string; sku: string | null; barcode: string | null; is_service: boolean;
  location_id: string | null; shelf_location: string | null;
}
// One loose shape, as elsewhere on the desktop: it compiles with strict off,
// where a { ok: true } | { ok: false; error } union doesn't narrow.
type Res<T = object> = { ok: boolean; error?: string } & Partial<T>;
const afterWrite = <T,>(p: Promise<T>) => p.then(async (r) => { void syncNow().catch(() => {}); return r; });
const listStorageLocationsAction = () => rpc<StorageLocationDto[]>("listStorageLocationsAction");
const countShelfLabelsAction = () => rpc<number>("countShelfLabelsAction");
const listShelfItemsAction = (id: string | null) => rpc<ShelfItemDto[]>("listShelfItemsAction", id);
const listProductsAction = () => rpc<ProductDto[]>("listProductsAction");
const saveStorageLocationAction = (d: { id?: string; parent_id: string | null; name: string; kind: string }) =>
  afterWrite(rpc<Res<{ id: string }>>("saveStorageLocationAction", d));
const deleteStorageLocationAction = (id: string) =>
  afterWrite(rpc<Res>("deleteStorageLocationAction", id));
const assignStorageLocationAction = (d: { location_id: string | null; product_ids: string[]; variant_ids: string[] }) =>
  afterWrite(rpc<Res<{ count: number }>>("assignStorageLocationAction", d));
const importShelfLabelsAction = () =>
  afterWrite(rpc<Res<{ shelves: number; products: number }>>("importShelfLabelsAction"));

/** The pseudo-place holding everything not on a shelf yet. */
const UNPLACED = "__unplaced__";

const KIND_ICON = { area: Warehouse, rack: LayoutGrid, shelf: Rows3 } as const;
const kindIcon = (kind: string) => KIND_ICON[kind as LocationKind] ?? Rows3;
/** What goes inside a place by default: a rack in an area, a shelf on a rack. */
const childKind = (kind: string | undefined): LocationKind => (kind === "area" ? "rack" : kind ? "shelf" : "rack");

interface Draft {
  id?: string;
  name: string;
  kind: LocationKind;
  parent_id: string | null;
}

/**
 * Shelves & racks — the tree of places on the left, what's kept at the chosen
 * one on the right. Places only say WHERE a product is; stock isn't split
 * between them (lib/storage-locations).
 */
export default function Shelves() {
  const { currentShop, role } = useShop();
  const canEdit = role === "owner" || role === "manager";
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [locations, setLocations] = useState<StorageLocationDto[]>([]);
  const [selected, setSelected] = useState<string>(UNPLACED);
  const [items, setItems] = useState<ShelfItemDto[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [labelCount, setLabelCount] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [moveTo, setMoveTo] = useState<string | null | undefined>(undefined);
  const [assignOpen, setAssignOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadPlaces = useCallback(async () => {
    try {
      const [rows, labels] = await Promise.all([listStorageLocationsAction(), countShelfLabelsAction()]);
      setLocations(rows);
      setLabelCount(labels);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load shelves");
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      setItems(await listShelfItemsAction(selected === UNPLACED ? null : selected));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load what's on this shelf");
    }
    setPicked(new Set());
    setLoadingItems(false);
  }, [selected]);

  useEffect(() => { void loadPlaces(); }, [loadPlaces]);
  useEffect(() => { void loadItems(); }, [loadItems]);

  const reload = () => Promise.all([loadPlaces(), loadItems()]);

  const tree = useMemo(() => buildLocationTree(locations), [locations]);
  const current = locations.find((l) => l.id === selected) ?? null;
  // A place's count includes everything on the places inside it.
  const totalAt = useCallback(
    (id: string) => {
      const inside = locationAndDescendants(id, locations);
      return locations.filter((l) => inside.has(l.id)).reduce((a, l) => a + l.item_count, 0);
    },
    [locations],
  );

  useAddNew({ "storage-location": canEdit && (() => setDraft({ name: "", kind: "rack", parent_id: null })) });

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.name.trim()) return toast.error("Give it a name, e.g. Rack A or Shelf 3");
    setBusy(true);
    const res = await saveStorageLocationAction({ ...draft, name: draft.name.trim() });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(draft.id ? "Saved" : `${draft.kind === "area" ? "Area" : draft.kind === "rack" ? "Rack" : "Shelf"} added`);
    setDraft(null);
    if (!draft.id) setSelected(res.id);
    await reload();
  };

  const removePlace = async (place: StorageLocationDto) => {
    const inside = locationAndDescendants(place.id, locations).size - 1;
    const ok = await confirm({
      title: `Delete “${place.name}”?`,
      description:
        (inside > 0 ? `The ${inside} place${inside === 1 ? "" : "s"} inside it go too. ` : "") +
        "Products on it aren't deleted — they just show as not on a shelf.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    const res = await deleteStorageLocationAction(place.id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Deleted");
    setSelected(UNPLACED);
    await loadPlaces();
  };

  /**
   * Move the ticked rows. A variant moves on its own (it gets a place of its
   * own); taking off the shelf a variant that shares its product's place takes
   * the whole product off, since that place belongs to the product.
   */
  const moveItems = async (locationId: string | null) => {
    const rows = items.filter((i) => picked.has(key(i)));
    if (!rows.length) return;
    const productIds = new Set<string>();
    const variantIds = new Set<string>();
    for (const r of rows) {
      if (r.variant_id && (r.own_place || locationId)) variantIds.add(r.variant_id);
      else productIds.add(r.product_id);
    }
    setBusy(true);
    const res = await assignStorageLocationAction({
      location_id: locationId,
      product_ids: [...productIds],
      variant_ids: [...variantIds],
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(locationId ? `Moved ${res.count} to ${locationPath(locationId, locations)}` : `Took ${res.count} off the shelf`);
    setMoveTo(undefined);
    await reload();
  };

  const importLabels = async () => {
    setBusy(true);
    const res = await importShelfLabelsAction();
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(`${res.shelves} shelf${res.shelves === 1 ? "" : "s"} created · ${res.products} products placed`);
    await reload();
  };

  const printSheet = () => {
    const title = current ? locationPath(current.id, locations) ?? current.name : "Not on a shelf";
    const html = buildCountSheetHtml({
      shopName: currentShop?.name ?? "",
      place: title,
      items: items.map((i) => ({
        name: i.name,
        sku: i.sku,
        unit: i.unit,
        stock: i.stock,
        place: current ? (locationPath(i.location_id, locations) ?? "") : "",
      })),
    });
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;opacity:0;pointer-events:none;border:0;";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) return iframe.remove();
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => iframe.remove(), 60_000);
  };

  const allPicked = items.length > 0 && items.every((i) => picked.has(key(i)));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><MapPin className="size-7 text-primary" /> Shelves &amp; racks</h1>
          <p className="text-muted-foreground mt-1">Where every product is kept — shown at the till so staff fetch it fast.</p>
        </div>
        {canEdit && (
          <Button onClick={() => setDraft({ name: "", kind: "rack", parent_id: null })} className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
            <Plus className="size-4 me-1.5" /> Add rack
          </Button>
        )}
      </header>

      {canEdit && labelCount > 0 && (
        <Card className="p-4 flex flex-wrap items-center justify-between gap-3 border-primary/40 bg-primary/5">
          <div className="text-sm">
            <b>{labelCount} product{labelCount === 1 ? "" : "s"}</b> still have a typed shelf label from before.
            Turn each label into a shelf and put the products on it?
          </div>
          <Button variant="outline" onClick={importLabels} disabled={busy}>
            <Wand2 className="size-4 me-1.5" /> Convert labels
          </Button>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card className="p-2 h-fit">
          <PlaceButton
            active={selected === UNPLACED}
            onClick={() => setSelected(UNPLACED)}
            icon={PackageSearch}
            label="Not on a shelf"
            muted
          />
          <div className="my-1 border-t" />
          {tree.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              No racks yet. Add one — e.g. <b>Rack A</b> — then its shelves.
            </p>
          ) : (
            <Tree nodes={tree} selected={selected} onSelect={setSelected} countOf={totalAt} />
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="p-4 border-b flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {current ? LOCATION_KINDS.find((k) => k.value === current.kind)?.label ?? "Place" : "Not on a shelf"}
              </div>
              <div className="text-lg font-semibold truncate">
                {current ? locationPath(current.id, locations) : "Products with no shelf yet"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {current && canEdit && current.kind !== "shelf" && (
                <Button size="sm" variant="outline" onClick={() => setDraft({ name: "", kind: childKind(current.kind), parent_id: current.id })}>
                  <Plus className="size-3.5 me-1" /> Add {childKind(current.kind)}
                </Button>
              )}
              {current && canEdit && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setDraft({ id: current.id, name: current.name, kind: current.kind as LocationKind, parent_id: current.parent_id })}>
                    <Pencil className="size-3.5 me-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => removePlace(current)}>
                    <Trash2 className="size-3.5 me-1 text-destructive" /> Delete
                  </Button>
                </>
              )}
              {current && canEdit && (
                <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                  <PackageSearch className="size-3.5 me-1" /> Put products here
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={printSheet} disabled={items.length === 0}>
                <Printer className="size-3.5 me-1" /> Count sheet
              </Button>
            </div>
          </div>

          {canEdit && picked.size > 0 && (
            <div className="px-4 py-2 border-b bg-muted/40 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{picked.size} selected</span>
              <Button size="sm" variant="outline" onClick={() => setMoveTo(null)}>
                <ArrowRightLeft className="size-3.5 me-1" /> Move to…
              </Button>
              {current && (
                <Button size="sm" variant="ghost" onClick={() => void moveItems(null)} disabled={busy}>
                  Take off the shelf
                </Button>
              )}
            </div>
          )}

          {loadingItems ? (
            <div className="p-10 text-center text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              {current ? "Nothing on here yet. Use “Put products here”." : "Every product has a shelf."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    {canEdit && (
                      <th className="p-3 w-8">
                        <Checkbox
                          checked={allPicked}
                          onCheckedChange={(v) => setPicked(v ? new Set(items.map(key)) : new Set())}
                          aria-label="Select all"
                        />
                      </th>
                    )}
                    <th className="p-3 text-start">Item</th>
                    {current && <th className="p-3 text-start hidden md:table-cell">Place</th>}
                    <th className="p-3 text-end">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={key(i)} className="border-t">
                      {canEdit && (
                        <td className="p-3">
                          <Checkbox
                            checked={picked.has(key(i))}
                            onCheckedChange={(v) =>
                              setPicked((s) => {
                                const n = new Set(s);
                                if (v) n.add(key(i));
                                else n.delete(key(i));
                                return n;
                              })
                            }
                            aria-label={`Select ${i.name}`}
                          />
                        </td>
                      )}
                      <td className="p-3">
                        <div className="font-medium">{i.name}</div>
                        {i.sku && <div className="text-xs text-muted-foreground font-mono">{i.sku}</div>}
                      </td>
                      {current && (
                        <td className="p-3 hidden md:table-cell text-muted-foreground">
                          {locationPath(i.location_id, locations)}
                          {i.own_place && <span className="ms-1 text-[10px] uppercase">· own place</span>}
                        </td>
                      )}
                      <td className={`p-3 text-end tabular-nums ${i.stock < 0 ? "text-warning" : ""}`}>
                        {formatQty(i.stock)} {i.unit ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Add / edit a place */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent data-add-new="storage-location" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit place" : "Add a place"}</DialogTitle>
            <DialogDescription>Racks can hold shelves; an area (the godown) can hold racks.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  autoFocus
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder={draft.kind === "area" ? "e.g. Godown" : draft.kind === "rack" ? "e.g. Rack A" : "e.g. Shelf 3"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v as LocationKind })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOCATION_KINDS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>{k.label} — {k.hint}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Inside</Label>
                <LocationSelect
                  value={draft.parent_id}
                  onChange={(id) => setDraft({ ...draft, parent_id: id })}
                  // A place can't be put inside itself or anything in it.
                  locations={draft.id ? locations.filter((l) => !locationAndDescendants(draft.id!, locations).has(l.id)) : locations}
                  placeholder="Nothing — a top-level place"
                  emptyLabel="Nothing — a top-level place"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button onClick={saveDraft} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move the ticked rows */}
      <Dialog open={moveTo !== undefined} onOpenChange={(o) => !o && setMoveTo(undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move {picked.size} item{picked.size === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>A variant moves on its own. Taking off one that&rsquo;s kept with its product takes the whole product off.</DialogDescription>
          </DialogHeader>
          <LocationSelect value={moveTo ?? null} onChange={setMoveTo} locations={locations} placeholder="Choose a shelf" emptyLabel="Take off the shelf" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveTo(undefined)}>Cancel</Button>
            <Button onClick={() => void moveItems(moveTo ?? null)} disabled={busy}>Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {current && (
        <AssignDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          place={current}
          locations={locations}
          onDone={async () => { setAssignOpen(false); await reload(); }}
        />
      )}
      {confirmDialog}
    </div>
  );
}

const key = (i: ShelfItemDto) => i.variant_id ?? i.product_id;

function PlaceButton({
  active, onClick, icon: Icon, label, count, depth = 0, muted,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof MapPin;
  label: string;
  count?: number;
  depth?: number;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-start transition-colors ${
        active ? "bg-primary/10 text-primary font-medium" : muted ? "text-muted-foreground hover:bg-muted" : "hover:bg-muted"
      }`}
      style={{ paddingInlineStart: `${8 + depth * 16}px` }}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate flex-1">{label}</span>
      {count !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{count}</span>}
    </button>
  );
}

function Tree({
  nodes, selected, onSelect, countOf,
}: {
  nodes: LocationNode<StorageLocationDto>[];
  selected: string;
  onSelect: (id: string) => void;
  countOf: (id: string) => number;
}) {
  return (
    <>
      {nodes.map((n) => (
        <div key={n.row.id}>
          <PlaceButton
            active={selected === n.row.id}
            onClick={() => onSelect(n.row.id)}
            icon={kindIcon(n.row.kind)}
            label={n.row.name}
            count={countOf(n.row.id)}
            depth={n.depth}
          />
          {n.children.length > 0 && <Tree nodes={n.children} selected={selected} onSelect={onSelect} countOf={countOf} />}
        </div>
      ))}
    </>
  );
}

/** Pick products to put on a place — searchable, with "not on a shelf" first. */
function AssignDialog({
  open, onOpenChange, place, locations, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  place: StorageLocationDto;
  locations: StorageLocationDto[];
  onDone: () => Promise<void>;
}) {
  const [products, setProducts] = useState<ProductDto[] | null>(null);
  const [search, setSearch] = useState("");
  const [onlyUnplaced, setOnlyUnplaced] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listProductsAction()
      .then((rows) => { if (!cancelled) setProducts(rows.filter((p) => !p.is_service)); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Couldn't load products"));
    return () => { cancelled = true; };
  }, [open]);

  const shown = (products ?? []).filter((p) => {
    if (onlyUnplaced && p.location_id) return false;
    const q = search.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q) || (p.barcode ?? "").includes(q);
  });

  const assign = async () => {
    setBusy(true);
    const res = await assignStorageLocationAction({ location_id: place.id, product_ids: [...picked], variant_ids: [] });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(`Put ${res.count} product${res.count === 1 ? "" : "s"} on ${place.name}`);
    setPicked(new Set());
    await onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Put products on {locationPath(place.id, locations)}</DialogTitle>
          <DialogDescription>Tick what&rsquo;s kept here. A product with variants moves with all of them.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-3" data-enter-skip>
          <div className="relative flex-1 min-w-48">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products" className="ps-9" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={onlyUnplaced} onCheckedChange={(v) => setOnlyUnplaced(!!v)} /> Only ones with no shelf
          </label>
        </div>
        <div className="border rounded-md max-h-[50vh] overflow-y-auto divide-y">
          {products === null ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : shown.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No products match.</div>
          ) : (
            shown.slice(0, 300).map((p) => (
              <label key={p.id} className="flex items-center gap-3 p-2.5 text-sm hover:bg-muted/40 cursor-pointer">
                <Checkbox
                  checked={picked.has(p.id)}
                  onCheckedChange={(v) =>
                    setPicked((s) => {
                      const n = new Set(s);
                      if (v) n.add(p.id);
                      else n.delete(p.id);
                      return n;
                    })
                  }
                />
                <span className="flex-1 min-w-0 truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[40%]">
                  {locationPath(p.location_id, locations) ?? (p.shelf_location ? `“${p.shelf_location}”` : "")}
                </span>
              </label>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={assign} disabled={busy || picked.size === 0}>
            {busy ? "Saving…" : `Put ${picked.size || ""} here`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
