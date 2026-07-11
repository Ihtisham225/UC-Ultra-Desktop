import { useEffect, useState } from "react";
import { rpc } from "@/lib/apiClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Copy, KeyRound, Loader2, RefreshCw, Trash2 } from "lucide-react";

interface Props { shopId: string; canManage: boolean }

type ApiKey = { id: string; label: string; key_prefix: string; created_at: string; last_used_at: string | null };

// The other app reads/writes this shop's catalog through these endpoints on the backend.
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") || "https://ucultra.com";
const FUNCTIONS_BASE = `${API_BASE}/api/catalog`;

export function IntegrationsSection({ shopId, canManage }: Props) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [label, setLabel] = useState("Zapzetta sync");
  const [busy, setBusy] = useState(false);

  const [remoteUrl, setRemoteUrl] = useState("");
  const [remoteKey, setRemoteKey] = useState("");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    try {
      const { keys: ks, sync: s } = await rpc<{ keys: ApiKey[]; sync: { remote_base_url: string | null; remote_api_key: string | null; last_sync_at: string | null; last_sync_status: string | null } | null }>(
        "listApiKeysAction",
      );
      setKeys(ks ?? []);
      if (s) {
        setRemoteUrl(s.remote_base_url ?? "");
        setRemoteKey(s.remote_api_key ?? "");
        setLastSync(s.last_sync_at);
        setLastStatus(s.last_sync_status);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    }
  };

  useEffect(() => { if (shopId) load(); }, [shopId]);

  const createKey = async () => {
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; key?: string; error?: string }>("createApiKeyAction", label || "External sync");
      if (!res.ok || !res.key) return toast.error(res.error ?? "Failed");
      setNewKey(res.key);
      toast.success("API key created — copy it now, you won't see it again");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
    load();
  };

  const deleteKey = async (id: string) => {
    if (!confirm("Revoke this key? Apps using it will lose access.")) return;
    try {
      await rpc("deleteApiKeyAction", id);
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    }
    toast.success("Key revoked");
    load();
  };

  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copied"); };

  const saveRemote = async () => {
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("saveSyncSettingsAction", {
        remote_base_url: remoteUrl.replace(/\/+$/, ""),
        remote_api_key: remoteKey,
      });
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
    toast.success("Sync settings saved");
  };

  const runSync = async () => {
    if (!remoteUrl || !remoteKey) return toast.error("Enter the remote URL and API key first");
    setSyncing(true);
    try {
      const res = await rpc<{ ok: boolean; summary?: string; error?: string }>("runCatalogSyncAction", {
        remote_base_url: remoteUrl.replace(/\/+$/, ""),
        remote_api_key: remoteKey,
      });
      if (!res.ok) return toast.error(res.error ?? "Sync failed");
      toast.success(res.summary ?? "Sync complete");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
    load();
  };

  if (!canManage) {
    return <Card className="p-6"><p className="text-sm text-muted-foreground">Only shop owners can manage integrations.</p></Card>;
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-card p-6 space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><KeyRound className="size-4" /> API keys</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Share an API key with another app (e.g. zapzetta) so it can read and update this shop's products & stock.
          </p>
        </div>

        <div className="flex gap-2">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. Zapzetta)" />
          <Button onClick={createKey} disabled={busy} className="bg-gradient-primary text-primary-foreground hover:opacity-90 shrink-0">
            Create key
          </Button>
        </div>

        {newKey && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
            <p className="text-xs font-medium">Copy this key now — it won't be shown again.</p>
            <div className="flex gap-2">
              <Input readOnly value={newKey} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copy(newKey)}><Copy className="size-4" /></Button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setNewKey(null)}>Done</Button>
          </div>
        )}

        <div className="space-y-2">
          {keys.length === 0 && <p className="text-xs text-muted-foreground">No API keys yet.</p>}
          {keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{k.label}</div>
                <div className="text-xs text-muted-foreground font-mono">{k.key_prefix}…</div>
                <div className="text-xs text-muted-foreground">
                  Created {new Date(k.created_at).toLocaleDateString()}
                  {k.last_used_at ? ` · Last used ${new Date(k.last_used_at).toLocaleString()}` : " · Never used"}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteKey(k.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <Separator />

        <div className="space-y-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Endpoints for the other app:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-2 py-1 font-mono break-all">GET {FUNCTIONS_BASE}/export</code>
            <Button variant="ghost" size="icon" onClick={() => copy(`${FUNCTIONS_BASE}/export`)}><Copy className="size-3.5" /></Button>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-2 py-1 font-mono break-all">POST {FUNCTIONS_BASE}/upsert</code>
            <Button variant="ghost" size="icon" onClick={() => copy(`${FUNCTIONS_BASE}/upsert`)}><Copy className="size-3.5" /></Button>
          </div>
          <p>Send the API key in the <code className="font-mono">x-api-key</code> header.</p>
        </div>
      </Card>

      <Card className="shadow-card p-6 space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><RefreshCw className="size-4" /> Sync with another app</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Two-way merge by SKU. Pulls products from the remote app and pushes yours back.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Remote catalog base URL</Label>
          <Input value={remoteUrl} onChange={(e) => setRemoteUrl(e.target.value)}
            placeholder="https://<remote-app>/api/catalog" />
          <p className="text-xs text-muted-foreground">
            On zapzetta: open Settings → Integrations → copy the base URL shown there.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Remote API key</Label>
          <Input value={remoteKey} onChange={(e) => setRemoteKey(e.target.value)} placeholder="ucu_…" className="font-mono" />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={saveRemote} disabled={busy}>Save</Button>
          <Button onClick={runSync} disabled={syncing} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
            {syncing ? <Loader2 className="size-4 mr-2 animate-spin" /> : <RefreshCw className="size-4 mr-2" />}
            Sync now
          </Button>
        </div>

        {lastSync && (
          <p className="text-xs text-muted-foreground">
            Last synced {new Date(lastSync).toLocaleString()}{lastStatus ? ` — ${lastStatus}` : ""}
          </p>
        )}
      </Card>
    </div>
  );
}
