// Dedicated brand management page — mirror of the web app's /brands.
// Online-only (RPC), like the other management screens.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Tag, Plus, Pencil, Trash2, WifiOff, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/ConfirmDialog";
import { useShop } from "@/contexts/ShopContext";
import { rpc } from "@/lib/apiClient";
import { type BrandDto } from "@/components/BrandSelect";

interface EditingBrand {
  id?: string;
  name: string;
}

export default function Brands() {
  const { role } = useShop();
  const navigate = useNavigate();
  const [items, setItems] = useState<BrandDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<EditingBrand | null>(null);
  const [saving, setSaving] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const canEdit = role === "owner" || role === "manager";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await rpc<BrandDto[]>("listBrandsAction"));
      setOffline(false);
    } catch (e) {
      if (e instanceof Error && e.message === "offline") setOffline(true);
      else toast.error(e instanceof Error ? e.message : "Failed to load brands");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return toast.error("Enter a brand name");
    setSaving(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("saveBrandAction", {
        id: editing.id,
        name,
      });
      if (!res.ok) throw new Error(res.error || "Failed to save brand");
      toast.success(editing.id ? "Brand updated" : "Brand added");
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save brand");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (b: BrandDto) => {
    const ok = await confirm({
      title: `Delete “${b.name}”?`,
      description: "Products keep their data but lose this brand.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("deleteBrandAction", b.id);
      if (!res.ok) throw new Error(res.error || "Failed to delete");
      toast.success("Brand deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const filtered = items.filter((b) => b.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Tag className="size-6 text-primary" /> Brands
          </h1>
          <p className="text-muted-foreground text-sm">
            Group products by brand — tap a brand to see its products.
          </p>
        </div>
        {canEdit && !offline && (
          <Button onClick={() => setEditing({ name: "" })} className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
            <Plus className="size-4 me-1.5" /> Add brand
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search brands…"
          aria-label="Search brands"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        {offline ? (
          <div className="p-10 text-center space-y-2">
            <WifiOff className="size-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Brands need an internet connection.</p>
          </div>
        ) : loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Tag className="size-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {items.length === 0 ? "No brands yet. Add one to group your products." : `No brands match “${search}”.`}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((b) => (
              <div key={b.id} className="flex items-center gap-2 px-4 py-2.5">
                <button
                  type="button"
                  className="flex items-center gap-1.5 min-w-0 flex-1 text-start hover:underline underline-offset-2"
                  title="View products in this brand"
                  onClick={() => navigate(`/products?brand=${b.id}`)}
                >
                  <span className="font-medium truncate">{b.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {b.product_count > 0 ? `· ${b.product_count} product${b.product_count === 1 ? "" : "s"}` : ""}
                  </span>
                </button>
                {canEdit && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" title="Edit" aria-label="Edit"
                      onClick={() => setEditing({ id: b.id, name: b.name })}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Delete" aria-label="Delete"
                      className="text-destructive hover:text-destructive" onClick={() => remove(b)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit brand" : "New brand"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="e.g. Samsung"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editing?.id ? "Save changes" : "Add brand"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
