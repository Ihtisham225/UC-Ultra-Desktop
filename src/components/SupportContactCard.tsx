import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ExternalLink, LifeBuoy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUPPORT_DEFAULTS, whatsappHref, type SupportContact } from "@/lib/support-contact";
import { rpc } from "@/lib/apiClient";

const adminGetSupportContactAction = () => rpc<SupportContact>("adminGetSupportContactAction");
const adminSaveSupportContactAction = (input: SupportContact) =>
  rpc<{ ok: boolean; error?: string; contact?: SupportContact }>("adminSaveSupportContactAction", input);

/**
 * The contact details the public Support page, Billing and the "subscription
 * required" screen show. Saved to platform_settings; live on the next page load.
 */
export function SupportContactCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SupportContact>(SUPPORT_DEFAULTS);
  const [saved, setSaved] = useState<SupportContact>(SUPPORT_DEFAULTS);

  useEffect(() => {
    adminGetSupportContactAction()
      .then((c) => { setForm(c); setSaved(c); })
      .catch(() => toast.error("Couldn't load the support contact"))
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof SupportContact) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const dirty = (Object.keys(form) as (keyof SupportContact)[]).some((k) => form[k] !== saved[k]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await adminSaveSupportContactAction(form);
      if (!res.ok) throw new Error(res.error);
      setForm(res.contact);
      setSaved(res.contact);
      toast.success("Support contact saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-8 grid place-items-center text-muted-foreground max-w-2xl">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const wa = whatsappHref(form.whatsapp);

  return (
    <form
      className="rounded-xl border bg-card divide-y max-w-2xl"
      onSubmit={(e) => { e.preventDefault(); if (dirty) save(); }}
    >
      <div className="p-4 flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold flex items-center gap-2">
            <LifeBuoy className="size-4 text-primary" /> Support contact
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Shown on the Support page, the Billing page and the &ldquo;subscription required&rdquo; screen.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="shrink-0">
          <Link to="/support">View page <ExternalLink className="size-3.5 ms-1" /></Link>
        </Button>
      </div>
      <div className="p-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="support-whatsapp">WhatsApp number</Label>
          <Input id="support-whatsapp" inputMode="tel" value={form.whatsapp} onChange={set("whatsapp")} placeholder="0310 5892935" />
          <p className="text-xs text-muted-foreground">
            {wa ? <>Opens <span className="font-mono">{wa.replace("https://", "")}</span></> : "Leave blank to hide the WhatsApp button."}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="support-phone">Phone number</Label>
          <Input id="support-phone" inputMode="tel" value={form.phone} onChange={set("phone")} placeholder={form.whatsapp || "0310 5892935"} />
          <p className="text-xs text-muted-foreground">For calls. Blank = same as WhatsApp.</p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="support-email">Email</Label>
          <Input id="support-email" type="email" value={form.email} onChange={set("email")} placeholder="support@example.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="support-company">Company name</Label>
          <Input id="support-company" value={form.companyName} onChange={set("companyName")} placeholder="Tech Town Swat" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="support-url">Company website</Label>
          <Input id="support-url" inputMode="url" value={form.companyUrl} onChange={set("companyUrl")} placeholder="https://techtownswat.com" />
        </div>
      </div>
      <div className="p-4 flex justify-end gap-2">
        {dirty && (
          <Button type="button" variant="ghost" onClick={() => setForm(saved)} disabled={saving}>Discard</Button>
        )}
        <Button type="submit" disabled={saving || !dirty}>
          {saving && <Loader2 className="size-4 animate-spin me-1.5" />} Save
        </Button>
      </div>
    </form>
  );
}
