"use client";

/**
 * The one-time "where should WhatsApp open?" question for a computer browser
 * (see lib/whatsapp-open). Mounted once, app-wide; it answers the event that
 * `openWhatsApp` fires when this computer hasn't chosen yet, and opens the
 * chat from inside the click so the browser doesn't block it.
 *
 * ⚠️ COPIED to the desktop app (`src/components/WhatsAppChooser.tsx`), where
 * it only ever shows in the plain-browser dev mode — the terminal decides by
 * itself.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { MessageCircle, Monitor, Globe } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  WA_CHOOSE_EVENT, getWaTarget, launchWhatsApp, setWaTarget, waDecidedByApp, type WaChooseDetail, type WaTarget,
} from "@/lib/whatsapp-open";

export function WhatsAppChooser() {
  const [pending, setPending] = useState<WaChooseDetail | null>(null);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    const onChoose = (e: Event) => setPending((e as CustomEvent<WaChooseDetail>).detail);
    window.addEventListener(WA_CHOOSE_EVENT, onChoose);
    return () => window.removeEventListener(WA_CHOOSE_EVENT, onChoose);
  }, []);

  const pick = (target: WaTarget) => {
    if (!pending) return;
    if (remember) setWaTarget(target);
    launchWhatsApp(pending.to, pending.text, target);
    setPending(null);
  };

  return (
    <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-5 text-success" /> Open WhatsApp in…
          </DialogTitle>
          <DialogDescription>
            Choose the app if WhatsApp is installed on this computer — the chat opens straight in it, without
            WhatsApp Web.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Button className="justify-start h-auto py-3" onClick={() => pick("app")} autoFocus>
            <Monitor className="size-4 me-2 shrink-0" />
            <span className="text-start">
              <span className="block font-medium">WhatsApp app</span>
              <span className="block text-xs opacity-80">Installed on this computer</span>
            </span>
          </Button>
          <Button variant="outline" className="justify-start h-auto py-3" onClick={() => pick("web")}>
            <Globe className="size-4 me-2 shrink-0" />
            <span className="text-start">
              <span className="block font-medium">WhatsApp Web</span>
              <span className="block text-xs text-muted-foreground">In a browser tab</span>
            </span>
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
          Remember on this computer (change it in Settings → Receipt)
        </label>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Settings → Receipt: where this computer opens WhatsApp. Per computer, saved
 * as soon as it changes (it is not a shop setting, so the Save button doesn't
 * apply). Read after mount — localStorage isn't there on the server.
 */
const noSubscribe = () => () => {};

export function WhatsAppTargetSetting() {
  // Snapshots, not effect-set state: the server renders "ask", the browser
  // reads the stored choice, and React reconciles the two without a mismatch.
  const [, rerender] = useState(0);
  const value = useSyncExternalStore(noSubscribe, () => getWaTarget() ?? "ask", () => "ask" as const);
  const auto = useSyncExternalStore(noSubscribe, waDecidedByApp, () => false);

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div>
        <Label>WhatsApp opens in</Label>
        <p className="text-xs text-muted-foreground">
          {auto
            ? "This app opens WhatsApp Desktop when it's installed, and WhatsApp Web when it isn't."
            : "For receipts and khata reminders, on this computer only. Pick the app if WhatsApp is installed here."}
        </p>
      </div>
      {!auto && (
        <Select
          value={value}
          onValueChange={(v) => {
            const next = v as "ask" | WaTarget;
            setWaTarget(next === "ask" ? null : next);
            rerender((n) => n + 1);
          }}
        >
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="app">WhatsApp app</SelectItem>
            <SelectItem value="web">WhatsApp Web</SelectItem>
            <SelectItem value="ask">Ask me</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
