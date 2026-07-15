// Brand picker for the product form: flat dropdown plus a "+" quick-add that
// creates a brand without leaving the form. Mirrors the web app's component;
// data goes through the RPC bridge, so it needs to be online.
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

export interface BrandDto {
  id: string;
  name: string;
  sort_order: number;
  product_count: number;
}

const NONE = "__none__";

export function BrandSelect({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  /** name is the selected brand's display name (for the legacy label). */
  onChange: (id: string | null, name: string | null) => void;
  disabled?: boolean;
}) {
  const [options, setOptions] = useState<BrandDto[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setOptions(await rpc<BrandDto[]>("listBrandsAction"));
    } catch {
      /* keep whatever we have */
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const quickAdd = async () => {
    const name = newName.trim();
    if (!name) return toast.error("Enter a brand name");
    setSaving(true);
    try {
      const res = await rpc<{ ok: boolean; id?: string; error?: string }>("saveBrandAction", { name });
      if (!res.ok || !res.id) throw new Error(res.error || "Failed to add brand");
      await load();
      onChange(res.id, name);
      setQuickAddOpen(false);
      setNewName("");
      toast.success("Brand added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add brand");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Select
        value={value ?? NONE}
        onValueChange={(v) => {
          if (v === NONE) return onChange(null, null);
          onChange(v, options.find((b) => b.id === v)?.name ?? null);
        }}
        disabled={disabled}
      >
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="No brand" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>No brand</SelectItem>
          {options.map((b) => (
            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Add brand"
        title="Add brand"
        disabled={disabled}
        onClick={() => setQuickAddOpen(true)}
      >
        <Plus className="size-4" />
      </Button>

      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New brand</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Samsung"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); quickAdd(); } }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAddOpen(false)}>Cancel</Button>
            <Button onClick={quickAdd} disabled={saving}>{saving ? "Adding…" : "Add brand"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
