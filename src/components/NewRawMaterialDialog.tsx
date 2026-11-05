import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RawMaterialsApi } from "@/lib/raw-materials";

export interface NewRawMaterial { id: string; name: string; unit: string; tracked: boolean }

/**
 * Add a raw material — from the Raw materials page or straight from a purchase.
 * Mount it only while open (`{open && <NewRawMaterialDialog … />}`), so each
 * time starts blank. ⚠️ COPIED verbatim to the desktop.
 */
export function NewRawMaterialDialog({ create, onClose, onCreated, initialName = "" }: {
  create: RawMaterialsApi["create"];
  onClose: () => void;
  onCreated: (m: NewRawMaterial) => void;
  initialName?: string;
}) {
  const [name, setName] = useState(initialName);
  const [unit, setUnit] = useState("");
  const [tracked, setTracked] = useState(true);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = name.trim();
    if (!n) return toast.error("Enter a name.");
    setBusy(true);
    try {
      const res = await create({ name: n, unit: unit.trim(), tracked });
      if (!res.ok || !res.id) return toast.error(res.error ?? "Couldn't add it");
      toast.success(`${n} added`);
      onCreated({ id: res.id, name: n, unit: unit.trim() || "pcs", tracked });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New raw material</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Name</Label>
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sugar" />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg" />
            </div>
          </div>
          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="rawTracked">Keep count of it</Label>
              <p className="text-xs text-muted-foreground mt-1">
                {tracked
                  ? "Stock goes up when you buy it and down when you use it (Production, Used & wasted)."
                  : "No stock is kept — salt, spices, tissue. What you pay for it counts as used straight away."}
              </p>
            </div>
            <Switch id="rawTracked" checked={tracked} onCheckedChange={setTracked} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} disabled={busy}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
