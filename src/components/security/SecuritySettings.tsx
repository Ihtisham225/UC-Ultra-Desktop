"use client";

/**
 * Settings → Security: the authenticator app (set up, recovery codes, turn
 * off) and which pages and figures are private behind it. Per person.
 *
 * ⚠️ COPIED verbatim to the desktop app (`src/components/security/`).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Lock, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { fmtDate } from "@/lib/date-format";
import { PRIVATE_DETAILS, PRIVATE_PAGES, type PrivateItem } from "@/lib/privacy";
import { securityApi } from "@/components/security/security-api";
import { usePrivacy } from "@/components/security/PrivacyProvider";

type Status = Awaited<ReturnType<typeof securityApi.status>>;
type Setup = { secret: string; qr_svg: string };

const err = (r: { ok: boolean }) => (r as { error?: string }).error ?? "Something went wrong";

export function SecuritySettings() {
  const privacy = usePrivacy();
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setStatus(await securityApi.status());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load your security settings");
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const begin = async () => {
    setBusy(true);
    const res = await securityApi.startSetup().catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }));
    setBusy(false);
    if (!res.ok) return toast.error(err(res));
    const r = res as unknown as Setup;
    setSetup({ secret: r.secret, qr_svg: r.qr_svg });
    setCode("");
  };

  const confirm = async (value = code) => {
    if (!/^\d{6}$/.test(value)) return toast.error("Enter the 6-digit code the app shows.");
    setBusy(true);
    const res = await securityApi.confirmSetup(value).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }));
    setBusy(false);
    if (!res.ok) {
      setCode("");
      return toast.error(err(res));
    }
    setSetup(null);
    setCodes((res as unknown as { recovery_codes: string[] }).recovery_codes);
    toast.success("Authenticator app is on");
    await load();
    await privacy.refresh();
  };

  const withCode = async <T,>(label: string, run: (token: string) => Promise<T>): Promise<T | null> => {
    const token = await privacy.unlock("security.settings", label);
    if (!token) return null;
    return run(token);
  };

  const disable = async () => {
    const res = await withCode("turning off the authenticator", (t) => securityApi.disable(t));
    if (!res) return;
    if (!res.ok) return toast.error(err(res));
    toast.success("Authenticator app is off — nothing is private now");
    setChosen(null);
    await load();
    await privacy.refresh();
  };

  const newCodes = async () => {
    const res = await withCode("new recovery codes", (t) => securityApi.regenerateCodes(t));
    if (!res) return;
    if (!res.ok) return toast.error(err(res));
    setCodes((res as unknown as { recovery_codes: string[] }).recovery_codes);
    await load();
  };

  const items = chosen ?? status?.privacy.items ?? [];
  const toggle = (key: string) => setChosen(items.includes(key) ? items.filter((k) => k !== key) : [...items, key]);
  const savePrivacy = async () => {
    const res = await withCode("your privacy settings", (t) => securityApi.savePrivacy({ items }, t));
    if (!res) return;
    if (!res.ok) return toast.error(err(res));
    toast.success("Saved — these now need your code");
    setChosen(null);
    await load();
    await privacy.refresh();
  };

  if (!status) return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  const dirty = chosen !== null && [...chosen].sort().join() !== [...status.privacy.items].sort().join();

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Smartphone className="size-4 text-primary" /> Authenticator app</h3>
            <p className="text-sm text-muted-foreground">
              Google Authenticator, Microsoft Authenticator, Authy or any other app that shows 6-digit codes.
              You use it to open the pages and figures you make private below.
            </p>
          </div>
          {status.mfa_enabled ? (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" variant="outline">On</Badge>
          ) : (
            <Badge variant="outline">Off</Badge>
          )}
        </div>

        {status.mfa_enabled ? (
          <div className="space-y-3">
            <p className="text-sm">
              On since {status.mfa_enabled_at ? fmtDate(status.mfa_enabled_at.slice(0, 10)) : "—"} ·{" "}
              {status.recovery_codes_left} recovery code{status.recovery_codes_left === 1 ? "" : "s"} left
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void newCodes()} disabled={busy}><KeyRound className="size-4 me-1.5" /> New recovery codes</Button>
              <Button variant="outline" className="text-destructive" onClick={() => void disable()} disabled={busy}><ShieldOff className="size-4 me-1.5" /> Turn off</Button>
            </div>
          </div>
        ) : setup ? (
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <div
              className="rounded-lg border bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
              aria-label="QR code to scan with your authenticator app"
              dangerouslySetInnerHTML={{ __html: setup.qr_svg }}
            />
            <div className="space-y-3 text-sm">
              <ol className="list-decimal space-y-1 ps-4">
                <li>In your authenticator app, tap <b>+</b> and scan this code.</li>
                <li>
                  Can&apos;t scan? Choose &ldquo;enter a setup key&rdquo; and type:
                  <div className="mt-1 flex items-center gap-2">
                    <code className="rounded bg-muted px-2 py-1 font-mono text-xs break-all">{setup.secret}</code>
                    <Button size="icon" variant="ghost" className="size-7" title="Copy"
                      onClick={() => void navigator.clipboard?.writeText(setup.secret.replace(/\s/g, "")).then(() => toast.success("Copied"))}>
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                </li>
                <li>Type the 6-digit code it shows:</li>
              </ol>
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="h-11 w-40 text-center text-xl tracking-[0.3em] font-mono"
                  value={code}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setCode(v);
                    if (v.length === 6) void confirm(v);
                  }}
                  disabled={busy}
                />
                <Button onClick={() => void confirm()} disabled={busy}>{busy ? "Checking…" : "Turn on"}</Button>
                <Button variant="ghost" onClick={() => setSetup(null)} disabled={busy}>Cancel</Button>
              </div>
            </div>
          </div>
        ) : (
          <Button onClick={() => void begin()} disabled={busy}><ShieldCheck className="size-4 me-1.5" /> Set up authenticator app</Button>
        )}

        {codes && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
            <div>
              <p className="font-semibold">Save your recovery codes</p>
              <p className="text-sm text-muted-foreground">
                If you lose your phone, each of these opens a private page once. They won&apos;t be shown again — write them down or keep them somewhere safe.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-5">
              {codes.map((c) => <span key={c} className="rounded bg-background px-2 py-1 text-center">{c}</span>)}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => void navigator.clipboard?.writeText(codes.join("\n")).then(() => toast.success("Copied"))}>
                <Copy className="size-3.5 me-1" /> Copy all
              </Button>
              <Button size="sm" onClick={() => setCodes(null)}>I&apos;ve saved them</Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Lock className="size-4 text-primary" /> Private pages &amp; figures</h3>
          <p className="text-sm text-muted-foreground">
            Ticked items need your code each time. Unlocking lasts only while you stay on that page — going anywhere else locks it again.
            This is just for you; it doesn&apos;t change what anyone else sees.
          </p>
        </div>
        {!status.mfa_enabled ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Set up the authenticator app above to make things private.</p>
        ) : (
          <>
            <ItemGroup title="Pages" items={PRIVATE_PAGES} chosen={items} onToggle={toggle} />
            <ItemGroup title="Figures on the dashboard" items={PRIVATE_DETAILS} chosen={items} onToggle={toggle} />
            <div className="flex justify-end gap-2">
              {dirty && <Button variant="ghost" onClick={() => setChosen(null)}>Undo changes</Button>}
              <Button onClick={() => void savePrivacy()} disabled={!dirty}>Save</Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function ItemGroup({ title, items, chosen, onToggle }: { title: string; items: PrivateItem[]; chosen: string[]; onToggle: (key: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <label key={i.key} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/40">
            <Checkbox checked={chosen.includes(i.key)} onCheckedChange={() => onToggle(i.key)} className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">{i.label}</span>
              <span className="block text-xs text-muted-foreground">{i.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
