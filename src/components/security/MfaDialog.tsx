"use client";

/**
 * Asks for the 6-digit code from the authenticator app (or a recovery code)
 * and hands back an unlock token. ⚠️ COPIED verbatim to the desktop app.
 */
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { securityApi } from "@/components/security/security-api";

export function MfaDialog({
  open,
  label,
  onDone,
}: {
  open: boolean;
  /** What is being unlocked, for the title. */
  label?: string;
  onDone: (token: string | null) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onDone(null); }}>
      <DialogContent className="sm:max-w-sm">
        {open && <CodeForm label={label} onDone={onDone} />}
      </DialogContent>
    </Dialog>
  );
}

function CodeForm({ label, onDone }: { label?: string; onDone: (token: string | null) => void }) {
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (value = code) => {
    const v = value.trim();
    if (!recovery && !/^\d{6}$/.test(v)) return setError("Enter the 6-digit code from your authenticator app.");
    if (recovery && !/^[0-9a-f]{4}-?[0-9a-f]{4}$/i.test(v)) return setError("A recovery code looks like abcd-1234.");
    setBusy(true);
    setError(null);
    const res = await securityApi
      .verify(v)
      .catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Couldn't check the code" }));
    setBusy(false);
    if (!res.ok) {
      setError((res as { error?: string }).error ?? "That code isn't right.");
      setCode("");
      return;
    }
    onDone((res as { token: string }).token);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" /> {label ? `Unlock ${label}` : "Enter your code"}
        </DialogTitle>
        <DialogDescription>
          {recovery
            ? "Type one of the recovery codes you saved. Each works once. Lost those too? Contact UC Ultra support — they can reset your authenticator once they've confirmed it's you."
            : "Open your authenticator app and type the 6-digit code for UC Ultra."}
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-3"
      >
        <Input
          autoFocus
          inputMode={recovery ? "text" : "numeric"}
          autoComplete="one-time-code"
          placeholder={recovery ? "abcd-1234" : "123 456"}
          className="h-12 text-center text-2xl tracking-[0.4em] font-mono"
          maxLength={recovery ? 9 : 7}
          value={code}
          onChange={(e) => {
            const v = recovery ? e.target.value : e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(v);
            setError(null);
            // Six digits is the whole code — check it without waiting for Enter.
            if (!recovery && v.length === 6) void submit(v);
          }}
          disabled={busy}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="button"
          className="text-xs text-muted-foreground underline"
          onClick={() => {
            setRecovery((r) => !r);
            setCode("");
            setError(null);
          }}
        >
          {recovery ? "Use the authenticator app instead" : "Lost your phone? Use a recovery code"}
        </button>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onDone(null)} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Checking…" : "Unlock"}</Button>
        </DialogFooter>
      </form>
    </>
  );
}
