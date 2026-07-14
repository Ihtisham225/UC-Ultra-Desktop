// Category picker for the product form: tree-indented dropdown plus a "+"
// quick-add that creates a category (optionally nested) without leaving the
// form. Mirrors the web app's component; data goes through the RPC bridge,
// so it needs to be online (product tables sync offline, categories don't).
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { rpc } from "@/lib/apiClient";

export interface CategoryDto {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  product_count: number;
}

export interface CategoryOption extends CategoryDto {
  depth: number;
}

/** Flatten the parent/child tree into a depth-annotated list (DFS order). */
export function flattenCategories(cats: CategoryDto[]): CategoryOption[] {
  const byParent = new Map<string | null, CategoryDto[]>();
  for (const c of cats) {
    const list = byParent.get(c.parent_id) ?? [];
    list.push(c);
    byParent.set(c.parent_id, list);
  }
  const out: CategoryOption[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const c of byParent.get(parentId) ?? []) {
      out.push({ ...c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

const NONE = "__none__";

export function CategorySelect({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  /** name is the selected category's display name (for the legacy label). */
  onChange: (id: string | null, name: string | null) => void;
  disabled?: boolean;
}) {
  const [options, setOptions] = useState<CategoryOption[]>([]);
  const [offline, setOffline] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState<string>(NONE);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setOptions(flattenCategories(await rpc<CategoryDto[]>("listCategoriesAction")));
      setOffline(false);
    } catch (e) {
      if (e instanceof Error && e.message === "offline") setOffline(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pick = (id: string | null) => {
    onChange(id, id ? options.find((o) => o.id === id)?.name ?? null : null);
  };

  const quickAdd = async () => {
    const name = newName.trim();
    if (!name) return toast.error("Enter a category name");
    setSaving(true);
    try {
      const res = await rpc<{ ok: boolean; id?: string; error?: string }>("saveCategoryAction", {
        name,
        parent_id: newParent === NONE ? null : newParent,
      });
      if (!res.ok || !res.id) throw new Error(res.error || "Failed to add category");
      await load();
      onChange(res.id, name);
      setQuickAddOpen(false);
      setNewName("");
      toast.success("Category added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add category");
    } finally {
      setSaving(false);
    }
  };

  if (offline) {
    return <p className="text-xs text-muted-foreground py-2">Categories need an internet connection.</p>;
  }

  return (
    <div className="flex gap-2">
      <Select
        value={value ?? NONE}
        onValueChange={(v) => pick(v === NONE ? null : v)}
        disabled={disabled}
      >
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="No category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>No category</SelectItem>
          {options.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {`${"   ".repeat(c.depth)}${c.depth > 0 ? "↳ " : ""}${c.name}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Add category"
        title="Add category"
        disabled={disabled}
        onClick={() => {
          setNewParent(value ?? NONE);
          setQuickAddOpen(true);
        }}
      >
        <Plus className="size-4" />
      </Button>

      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Accessories"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); quickAdd(); } }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Parent category</Label>
              <Select value={newParent} onValueChange={setNewParent}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None (top level)</SelectItem>
                  {options.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {`${"   ".repeat(c.depth)}${c.depth > 0 ? "↳ " : ""}${c.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAddOpen(false)}>Cancel</Button>
            <Button onClick={quickAdd} disabled={saving}>{saving ? "Adding…" : "Add category"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
