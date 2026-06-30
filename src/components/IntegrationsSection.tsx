import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Copy, KeyRound, Loader2, RefreshCw, Trash2 } from "lucide-react";

interface Props { shopId: string; canManage: boolean }

type ApiKey = { id: string; label: string; key_prefix: string; created_at: string; last_used_at: string | null };

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "ucu_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

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
    const [{ data: ks }, { data: s }] = await Promise.all([
      supabase.from("shop_api_keys").select("id,label,key_prefix,created_at,last_used_at").eq("shop_id", shopId).order("created_at", { ascending: false }),
      supabase.from("shop_sync_settings").select("*").eq("shop_id", shopId).maybeSingle(),
    ]);
    setKeys(ks ?? []);
    if (s) {
      setRemoteUrl(s.remote_base_url ?? "");
      setRemoteKey(s.remote_api_key ?? "");
      setLastSync(s.last_sync_at);
      setLastStatus(s.last_sync_status);
    }
  };

  useEffect(() => { if (shopId) load(); }, [shopId]);

  const createKey = async () => {
    setBusy(true);
    const plain = randomKey();
    const hash = await sha256Hex(plain);
    const { error } = await supabase.from("shop_api_keys").insert({
      shop_id: shopId,
      label: label || "External sync",
      key_prefix: plain.slice(0, 12),
      key_hash: hash,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setNewKey(plain);
    toast.success("API key created — copy it now, you won't see it again");
    load();
  };

  const deleteKey = async (id: string) => {
    if (!confirm("Revoke this key? Apps using it will lose access.")) return;
    const { error } = await supabase.from("shop_api_keys").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Key revoked");
    load();
  };

  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copied"); };

  const saveRemote = async () => {
    setBusy(true);
    const { error } = await supabase.from("shop_sync_settings").upsert({
      shop_id: shopId,
      remote_base_url: remoteUrl.replace(/\/+$/, ""),
      remote_api_key: remoteKey,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Sync settings saved");
  };

  const runSync = async () => {
    if (!remoteUrl || !remoteKey) return toast.error("Enter the remote URL and API key first");
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("catalog-sync", {
      body: { shop_id: shopId, remote_base_url: remoteUrl.replace(/\/+$/, ""), remote_api_key: remoteKey },
    });
    setSyncing(false);
    if (error) return toast.error(error.message);
    if ((data as any)?.error) return toast.error((data as any).error);
    toast.success((data as any)?.summary ?? "Sync complete");
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
            <code className="flex-1 rounded bg-muted px-2 py-1 font-mono break-all">GET {FUNCTIONS_BASE}/catalog-export</code>
            <Button variant="ghost" size="icon" onClick={() => copy(`${FUNCTIONS_BASE}/catalog-export`)}><Copy className="size-3.5" /></Button>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-2 py-1 font-mono break-all">POST {FUNCTIONS_BASE}/catalog-upsert</code>
            <Button variant="ghost" size="icon" onClick={() => copy(`${FUNCTIONS_BASE}/catalog-upsert`)}><Copy className="size-3.5" /></Button>
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
          <Label>Remote functions base URL</Label>
          <Input value={remoteUrl} onChange={(e) => setRemoteUrl(e.target.value)}
            placeholder="https://<remote-project>.functions.supabase.co" />
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
