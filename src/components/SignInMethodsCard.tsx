import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KeyRound, Mail, ShieldCheck, Link2, Unlink, Clock } from "lucide-react";
import { toast } from "sonner";
import { rpc } from "@/lib/apiClient";
import { WEB_APP_URL } from "@/config/webApp";

export interface SignInMethods {
  email: string;
  has_password: boolean;
  google: { provider_email: string | null } | null;
  pending_email: string | null;
}

type Result = { ok: boolean; error?: string };

const getSignInMethodsAction = () => rpc<SignInMethods>("getSignInMethodsAction");
const setPasswordAction = (input: unknown) => rpc<Result>("setPasswordAction", input);
const requestEmailChangeAction = (input: unknown) => rpc<Result>("requestEmailChangeAction", input);
const cancelEmailChangeAction = () => rpc<Result>("cancelEmailChangeAction");
const unlinkGoogleAction = () => rpc<Result>("unlinkGoogleAction");

/**
 * How the owner gets into their own account: password, email address, and the
 * connected Google account — each changeable without losing the others.
 */
export function SignInMethodsCard({ onLinkGoogle }: { onLinkGoogle?: () => void }) {
  const [state, setState] = useState<SignInMethods | null>(null);
  const [busy, setBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [emailForm, setEmailForm] = useState({ next: "", current_password: "" });

  const load = useCallback(async () => {
    try { setState(await getSignInMethodsAction()); } catch { /* signed out */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const savePassword = async () => {
    if (pw.next !== pw.confirm) return toast.error("The two passwords don't match");
    setBusy(true);
    const res = await setPasswordAction({ current_password: pw.current || undefined, new_password: pw.next });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(state?.has_password ? "Password changed" : "Password created");
    setPwOpen(false); setPw({ current: "", next: "", confirm: "" });
    load();
  };

  const saveEmail = async () => {
    setBusy(true);
    const res = await requestEmailChangeAction({
      new_email: emailForm.next,
      current_password: emailForm.current_password || undefined,
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(`Confirmation sent to ${emailForm.next}. Open it to finish the change.`);
    setEmailOpen(false); setEmailForm({ next: "", current_password: "" });
    load();
  };

  const unlink = async () => {
    setBusy(true);
    const res = await unlinkGoogleAction();
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Google account disconnected");
    load();
  };

  const cancelPending = async () => {
    await cancelEmailChangeAction();
    toast.success("Email change cancelled");
    load();
  };

  const linkGoogle = () => {
    if (onLinkGoogle) return onLinkGoogle();
    // Connecting Google is an OAuth redirect, and the desktop signs in with a
    // device token rather than a browser cookie — so it has to happen on the
    // website, where that round-trip can complete.
    void window.electronAPI?.openExternal?.(`${WEB_APP_URL}/settings`);
    toast.info("Opening ucultra.com — sign in there, then use Settings → Sign-in methods.", {
      duration: 8000,
    });
  };

  if (!state) return null;

  return (
    <Card className="shadow-card p-6 space-y-4 mt-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" /> Sign-in methods
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          How you get into this account. At least one method must always work.
        </p>
      </div>

      {/* Email */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        <div className="min-w-0">
          <div className="text-sm font-medium flex items-center gap-2">
            <Mail className="size-4 text-muted-foreground" /> Email
          </div>
          <div className="text-sm text-muted-foreground truncate">{state.email}</div>
          {state.pending_email && (
            <div className="text-xs text-warning flex items-center gap-1 mt-1">
              <Clock className="size-3" /> Waiting for {state.pending_email} to be confirmed
              <button onClick={cancelPending} className="underline ms-1 hover:text-foreground">cancel</button>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setEmailOpen(true)}>Change email</Button>
      </div>

      {/* Password */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        <div className="min-w-0">
          <div className="text-sm font-medium flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" /> Password
          </div>
          <div className="text-sm text-muted-foreground">
            {state.has_password ? "Set" : "Not set — you sign in with Google only"}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPwOpen(true)}>
          {state.has_password ? "Change password" : "Create a password"}
        </Button>
      </div>

      {/* Google */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        <div className="min-w-0">
          <div className="text-sm font-medium flex items-center gap-2">
            Google
            {state.google && <Badge variant="secondary">Connected</Badge>}
          </div>
          <div className="text-sm text-muted-foreground truncate">
            {state.google
              ? (state.google.provider_email ?? "Connected")
              : "Not connected"}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={linkGoogle}>
            <Link2 className="size-3.5 me-1" />
            {state.google ? "Switch account" : "Connect Google"}
          </Button>
          {state.google && (
            <Button
              variant="ghost" size="sm" onClick={unlink} disabled={busy || !state.has_password}
              title={state.has_password ? "Disconnect" : "Create a password first"}
            >
              <Unlink className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {state.google && !state.has_password && (
        <p className="text-xs text-muted-foreground">
          Create a password before disconnecting Google — otherwise you would have no way back in.
        </p>
      )}

      {/* Password dialog */}
      <Dialog open={pwOpen} onOpenChange={(o) => !o && setPwOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{state.has_password ? "Change password" : "Create a password"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {state.has_password && (
              <div className="space-y-1.5">
                <Label>Current password</Label>
                <Input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>New password</Label>
              <Input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="At least 8 characters" />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm new password</Label>
              <Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={savePassword} disabled={busy || pw.next.length < 8}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email dialog */}
      <Dialog open={emailOpen} onOpenChange={(o) => !o && setEmailOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Change sign-in email</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>New email</Label>
              <Input
                type="email" value={emailForm.next}
                onChange={(e) => setEmailForm({ ...emailForm, next: e.target.value })}
                placeholder="you@example.com"
              />
              <p className="text-xs text-muted-foreground">
                Nothing changes until you open the confirmation link sent to the new address.
              </p>
            </div>
            {state.has_password && (
              <div className="space-y-1.5">
                <Label>Current password</Label>
                <Input
                  type="password" value={emailForm.current_password}
                  onChange={(e) => setEmailForm({ ...emailForm, current_password: e.target.value })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={saveEmail} disabled={busy || !emailForm.next}>Send confirmation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
