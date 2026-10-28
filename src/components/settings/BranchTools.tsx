/**
 * Settings → Danger zone (clear store data, delete another branch) and
 * Settings → Data (import from another branch). COPIED verbatim to the desktop;
 * each app passes its own `api` (server actions on the web, rpc() there).
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Eraser, Import, Trash2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { describeImport, type BranchDto, type BranchImportCounts, type BranchImportOptions } from "@/lib/branches";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface BranchToolsApi {
  listBranches: () => Promise<{ branches: BranchDto[]; isFirstBranch: boolean }>;
  clearData: (confirmName: string) => Promise<Result<{ removed: number }>>;
  deleteBranch: (shopId: string, confirmName: string) => Promise<Result>;
  importFromBranch: (input: { sourceShopId: string } & BranchImportOptions) => Promise<Result<{ counts: BranchImportCounts }>>;
}

const errorOf = (r: { ok: boolean; error?: string }) => r.error ?? "Something went wrong";

function useBranches(api: BranchToolsApi) {
  const [data, setData] = useState<{ branches: BranchDto[]; isFirstBranch: boolean } | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    let alive = true;
    api.listBranches()
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData({ branches: [], isFirstBranch: false }); });
    return () => { alive = false; };
  }, [api, round]);
  const reload = useCallback(() => setRound((r) => r + 1), []);
  return { data, reload };
}

/** A destructive confirmation that only unlocks once the store's name is typed. */
function TypeNameConfirm(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: React.ReactNode;
  name: string;
  action: string;
  busy: boolean;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === props.name.trim();
  return (
    <AlertDialog open={props.open} onOpenChange={(o) => { if (!o) setTyped(""); props.onOpenChange(o); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{props.title}</AlertDialogTitle>
          <AlertDialogDescription asChild><div>{props.description}</div></AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="type-name-confirm">Type <span className="font-semibold">{props.name}</span> to confirm</Label>
          <Input
            id="type-name-confirm"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={props.name}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={props.busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); if (matches) props.onConfirm(); }}
            disabled={!matches || props.busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {props.busy ? "Working…" : props.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Clear store data ───────────────────────────────────────────────────────

export function ClearStoreDataCard({ shopName, api, onCleared }: {
  shopName: string;
  api: BranchToolsApi;
  /** Called after a successful clear — reload the app so no screen shows the old data. */
  onCleared: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const res = await api.clearData(shopName);
      if (!res.ok) return toast.error(errorOf(res));
      toast.success(`Cleared ${res.removed.toLocaleString()} records. ${shopName} is a fresh store.`);
      setOpen(false);
      onCleared();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not clear the store's data.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="shadow-card p-6 space-y-4 border-destructive/30">
      <div>
        <h3 className="font-semibold text-destructive">Clear all store data</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Start <span className="font-medium text-foreground">{shopName}</span> again as a fresh store. Every product,
          customer, supplier, bill, purchase, return, ledger entry, expense, money account, payroll record and
          investor is permanently deleted. The store itself stays — its settings, staff, roles and plan are kept,
          and order numbers start again from 1.
        </p>
      </div>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Eraser className="size-4 mr-2" />Clear all data
      </Button>
      <TypeNameConfirm
        open={open}
        onOpenChange={setOpen}
        title={`Clear everything in ${shopName}?`}
        description={
          <>
            This cannot be undone. Export anything you want to keep first (Settings → Data). Desktop terminals
            signed in to this store wipe their offline copy on their next sync.
          </>
        }
        name={shopName}
        action="Yes, clear all data"
        busy={busy}
        onConfirm={run}
      />
    </Card>
  );
}

// ─── Other branches (delete from the first branch) ──────────────────────────

export function BranchesCard({ api }: { api: BranchToolsApi }) {
  const { data, reload } = useBranches(api);
  const [target, setTarget] = useState<BranchDto | null>(null);
  const [busy, setBusy] = useState(false);

  if (!data || data.branches.length < 2) return null;
  const first = data.branches.find((b) => b.is_first);
  const others = data.branches.filter((b) => !b.is_current);

  const run = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const res = await api.deleteBranch(target.id, target.name);
      if (!res.ok) return toast.error(errorOf(res));
      toast.success(`Deleted ${target.name}`);
      setTarget(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete that branch.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="shadow-card p-6 space-y-4 border-destructive/30">
      <div>
        <h3 className="font-semibold text-destructive">Other branches</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {data.isFirstBranch
            ? "Stores you own besides this one. Deleting a branch removes it and everything in it for good."
            : <>Other branches can be deleted from your first branch, <span className="font-medium text-foreground">{first?.name}</span>.</>}
        </p>
      </div>
      <ul className="divide-y rounded-md border">
        {others.map((b) => (
          <li key={b.id} className="flex items-center gap-3 p-3">
            <Store className="size-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate flex items-center gap-2">
                {b.name}
                {b.is_first && <Badge variant="secondary">First branch</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">
                {b.products.toLocaleString()} products · {b.customers.toLocaleString()} customers · {b.suppliers.toLocaleString()} suppliers
              </div>
            </div>
            {data.isFirstBranch && (
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => setTarget(b)}>
                <Trash2 className="size-3.5 mr-1.5" />Delete
              </Button>
            )}
          </li>
        ))}
      </ul>
      <TypeNameConfirm
        open={!!target}
        onOpenChange={(o) => { if (!o) setTarget(null); }}
        title={`Delete the branch ${target?.name ?? ""}?`}
        description={<>The store and every record in it — products, bills, ledger, staff access — are deleted permanently.</>}
        name={target?.name ?? ""}
        action="Yes, delete branch"
        busy={busy}
        onConfirm={run}
      />
    </Card>
  );
}

// ─── Import from another branch ─────────────────────────────────────────────

export function ImportFromBranchCard({ api, onImported }: { api: BranchToolsApi; onImported?: () => void }) {
  const { data } = useBranches(api);
  const [sourceId, setSourceId] = useState("");
  const [opts, setOpts] = useState<BranchImportOptions>({ products: true, customers: true, suppliers: true });
  const [busy, setBusy] = useState(false);

  const sources = data?.branches.filter((b) => !b.is_current) ?? [];
  if (!data || sources.length === 0) return null;
  const source = sources.find((b) => b.id === sourceId);

  const run = async () => {
    if (!source) return toast.error("Pick the branch to import from");
    if (!opts.products && !opts.customers && !opts.suppliers) return toast.error("Choose what to import");
    setBusy(true);
    try {
      const res = await api.importFromBranch({ sourceShopId: source.id, ...opts });
      if (!res.ok) return toast.error(errorOf(res));
      toast.success(describeImport(res.counts, opts) || "Nothing new to import");
      onImported?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The import failed; nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  const option = (key: keyof BranchImportOptions, label: string, count?: number) => (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <Checkbox checked={opts[key]} onCheckedChange={(v) => setOpts((o) => ({ ...o, [key]: v === true }))} />
      {label}
      {count !== undefined && <span className="text-muted-foreground">({count.toLocaleString()})</span>}
    </label>
  );

  return (
    <Card className="shadow-card p-6 space-y-4">
      <div>
        <h3 className="font-semibold">Import from another branch</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Copy products, customers and suppliers from another store you own into this one. Products arrive with
          zero stock and parties with no balance — each branch keeps its own stock and ledger. Anything already
          here (same SKU or name) is skipped, so it is safe to run again.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label>Import from</Label>
        <Select value={sourceId} onValueChange={setSourceId}>
          <SelectTrigger className="sm:max-w-sm"><SelectValue placeholder="Choose a branch" /></SelectTrigger>
          <SelectContent>
            {sources.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {option("products", "Products", source?.products)}
        {option("customers", "Customers", source?.customers)}
        {option("suppliers", "Suppliers", source?.suppliers)}
      </div>
      <Button onClick={run} disabled={busy || !source}>
        <Import className="size-4 mr-2" />{busy ? "Importing…" : "Import"}
      </Button>
    </Card>
  );
}
