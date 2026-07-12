import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Send, Loader2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { rpc } from "@/lib/apiClient";

interface WhatsAppSettings {
  enabled: boolean;
  phone_number_id: string;
  template_name: string;
  template_lang: string;
  /** Whether an access token is stored (the token itself never leaves the server). */
  has_token: boolean;
  /** Paste these into Meta's "Configure Webhooks" step to get delivery statuses. */
  webhook_url: string;
  webhook_verify_token: string;
}

type ActionResult = { ok: boolean; error?: string };

/**
 * Central WhatsApp Business sender settings (Meta Cloud API) — identical to
 * the web admin's card, driven through the desktop RPC bridge. One
 * platform-owned number sends the receipt template for every shop; the
 * template's body variables are:
 *   {{1}} shop name · {{2}} receipt number · {{3}} total · {{4}} date
 */
export function WhatsAppSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateLang, setTemplateLang] = useState("en");
  const [testPhone, setTestPhone] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookToken, setWebhookToken] = useState("");

  useEffect(() => {
    rpc<WhatsAppSettings>("adminGetWhatsAppSettingsAction")
      .then((s) => {
        setEnabled(s.enabled);
        setPhoneNumberId(s.phone_number_id);
        setTemplateName(s.template_name);
        setTemplateLang(s.template_lang);
        setHasToken(s.has_token);
        setWebhookUrl(s.webhook_url);
        setWebhookToken(s.webhook_verify_token);
      })
      .catch(() => toast.error("Couldn't load WhatsApp settings"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await rpc<ActionResult>("adminSaveWhatsAppSettingsAction", {
        enabled,
        phone_number_id: phoneNumberId,
        access_token: accessToken || undefined,
        template_name: templateName,
        template_lang: templateLang,
      });
      if (!res.ok) throw new Error(res.error || "Save failed");
      if (accessToken) setHasToken(true);
      setAccessToken("");
      toast.success("WhatsApp settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testPhone.trim()) return toast.error("Enter a phone number to test with");
    setTesting(true);
    try {
      const res = await rpc<ActionResult>("adminSendWhatsAppTestAction", testPhone);
      if (!res.ok) throw new Error(res.error || "Test failed");
      toast.success("Test message sent — check WhatsApp");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-8 grid place-items-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card divide-y max-w-2xl">
      <div className="p-4 flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold flex items-center gap-2">
            <MessageCircle className="size-4 text-primary" /> WhatsApp receipts
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Receipts are sent from this central WhatsApp Business number on behalf of every shop.
            Create a Meta app with the WhatsApp product, then paste the credentials below.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enable WhatsApp receipts" />
      </div>

      <div className="p-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="wa-phone-id">Phone number ID</Label>
          <Input
            id="wa-phone-id"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="e.g. 123456789012345"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wa-token">Access token</Label>
          <Input
            id="wa-token"
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={hasToken ? "•••••••• (saved — leave blank to keep)" : "Permanent system-user token"}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wa-template">Template name</Label>
          <Input
            id="wa-template"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="e.g. pos_receipt"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wa-lang">Template language</Label>
          <Input
            id="wa-lang"
            value={templateLang}
            onChange={(e) => setTemplateLang(e.target.value)}
            placeholder="en"
          />
        </div>
        <p className="sm:col-span-2 text-xs text-muted-foreground">
          The approved template&apos;s body must use exactly four variables, in this order:
          {" "}<code>{"{{1}}"}</code> shop name, <code>{"{{2}}"}</code> receipt number,
          {" "}<code>{"{{3}}"}</code> total, <code>{"{{4}}"}</code> date.
        </p>
        <div className="sm:col-span-2">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <div className="font-medium text-sm">Webhook (delivery statuses)</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            In Meta&apos;s <b>Configure Webhooks</b> step, paste these and subscribe to the{" "}
            <code>messages</code> field. Receipts then update from &quot;sent&quot; to
            delivered/read/failed in the notification log.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="wa-webhook-url">Callback URL</Label>
            <div className="flex gap-1.5">
              <Input id="wa-webhook-url" value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                aria-label="Copy callback URL"
                onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Callback URL copied"); }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-webhook-token">Verify token</Label>
            <div className="flex gap-1.5">
              <Input id="wa-webhook-token" value={webhookToken} readOnly className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                aria-label="Copy verify token"
                onClick={() => { navigator.clipboard.writeText(webhookToken); toast.success("Verify token copied"); }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-2">
        <Label htmlFor="wa-test">Send a test receipt</Label>
        <div className="flex gap-2">
          <Input
            id="wa-test"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="03xx-xxxxxxx or 92xxxxxxxxxx"
            className="max-w-xs"
          />
          <Button variant="outline" onClick={sendTest} disabled={testing}>
            <Send className="size-4 me-1.5" /> {testing ? "Sending…" : "Send test"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Uses the saved credentials and template with sample values.
        </p>
      </div>
    </div>
  );
}
