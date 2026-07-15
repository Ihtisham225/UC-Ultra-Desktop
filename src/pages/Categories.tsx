// Dedicated category management page — mirror of the web app's /categories.
// Online-only (RPC), like the other management screens.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FolderTree, Plus, Pencil, Trash2, CornerDownRight, WifiOff, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useConfirm } from "@/components/ConfirmDialog";
import { useShop } from "@/contexts/ShopContext";
import { rpc } from "@/lib/apiClient";
import { flattenCategories, type CategoryDto, type CategoryOption } from "@/components/CategorySelect";

const NONE = "__none__";

interface EditingCategory {
  id?: string;
  name: string;
  parent_id: string | null;
}

export default function Categories() {
  const { role } = useShop();
  const navigate = useNavigate();
  const [items, setItems] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<EditingCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const canEdit = role === "owner" || role === "manager";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(flattenCategories(await rpc<CategoryDto[]>("listCategoriesAction")));
      setOffline(false);
    } catch (e) {
      if (e instanceof Error && e.message === "offline") setOffline(true);
      else toast.error(e instanceof Error ? e.message : "Failed to load categories");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return toast.error("Enter a category name");
    setSaving(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("saveCategoryAction", {
        id: editing.id,
        name,
        parent_id: editing.parent_id,
      });
      if (!res.ok) throw new Error(res.error || "Failed to save category");
      toast.success(editing.id ? "Category updated" : "Category added");
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: CategoryOption) => {
    const hasChildren = items.some((x) => x.parent_id === c.id);
    const ok = await confirm({
      title: `Delete “${c.name}”?`,
      description: hasChildren
        ? "Its sub-categories are deleted too. Products keep their data but lose this category."
        : "Products keep their data but lose this category.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("deleteCategoryAction", c.id);
      if (!res.ok) throw new Error(res.error || "Failed to delete");
      toast.success("Category deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  // Valid parents for the edit dialog: everything except the node itself and
  // its descendants (the server re-validates; this just keeps the menu sane).
  const parentOptions = (self?: string) => {
    if (!self) return items;
    const blocked = new Set<string>([self]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of items) {
        if (c.parent_id && blocked.has(c.parent_id) && !blocked.has(c.id)) {
          blocked.add(c.id);
          grew = true;
        }
      }
    }
    return items.filter((c) => !blocked.has(c.id));
  };

  // Search keeps matches plus their ancestors so the tree indentation stays
  // meaningful.
  const q = search.trim().toLowerCase();
  const visibleItems = (() => {
    if (!q) return items;
    const byId = new Map(items.map((c) => [c.id, c]));
    const keep = new Set<string>();
    for (const c of items) {
      if (!c.name.toLowerCase().includes(q)) continue;
      let cur: CategoryOption | undefined = c;
      while (cur && !keep.has(cur.id)) {
        keep.add(cur.id);
        cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
      }
    }
    return items.filter((c) => keep.has(c.id));
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <FolderTree className="size-6 text-primary" /> Categories
          </h1>
          <p className="text-muted-foreground text-sm">
            Organize products into categories and sub-categories.
          </p>
        </div>
        {canEdit && !offline && (
          <Button onClick={() => setEditing({ name: "", parent_id: null })} className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
            <Plus className="size-4 me-1.5" /> Add category
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search categories…"
          aria-label="Search categories"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        {offline ? (
          <div className="p-10 text-center space-y-2">
            <WifiOff className="size-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Categories need an internet connection.</p>
          </div>
        ) : loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : visibleItems.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <FolderTree className="size-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {items.length === 0
                ? "No categories yet. Add one — you can nest sub-categories under it."
                : `No categories match “${search}”.`}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {visibleItems.map((c) => (
              <div key={c.id} className="flex items-center gap-2 px-4 py-2.5">
                <button
                  type="button"
                  className="flex items-center gap-1.5 min-w-0 flex-1 text-start hover:underline underline-offset-2"
                  title="View products in this category"
                  style={{ paddingInlineStart: `${c.depth * 1.5}rem` }}
                  onClick={() => navigate(`/products?category=${c.id}`)}
                >
                  {c.depth > 0 && <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground rtl-flip" />}
                  <span className="font-medium truncate">{c.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {c.product_count > 0 ? `· ${c.product_count} product${c.product_count === 1 ? "" : "s"}` : ""}
                  </span>
                </button>
                {canEdit && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" title="Add sub-category" aria-label="Add sub-category"
                      onClick={() => setEditing({ name: "", parent_id: c.id })}>
                      <Plus className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Edit" aria-label="Edit"
                      onClick={() => setEditing({ id: c.id, name: c.name, parent_id: c.parent_id })}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Delete" aria-label="Delete"
                      className="text-destructive hover:text-destructive" onClick={() => remove(c)}>
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
            <DialogTitle>{editing?.id ? "Edit category" : "New category"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Accessories"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Parent category</Label>
                <Select
                  value={editing.parent_id ?? NONE}
                  onValueChange={(v) => setEditing({ ...editing, parent_id: v === NONE ? null : v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None (top level)</SelectItem>
                    {parentOptions(editing.id).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {`${"   ".repeat(c.depth)}${c.depth > 0 ? "↳ " : ""}${c.name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editing?.id ? "Save changes" : "Add category"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
