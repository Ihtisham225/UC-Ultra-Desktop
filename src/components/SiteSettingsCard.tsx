// Site branding managed by the super admin — mirror of the web admin's card,
// driven through the desktop RPC bridge (uploads via a dedicated endpoint).
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Globe, Loader2, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { rpc, uploadSiteAsset } from "@/lib/apiClient";

type SiteAssetKind = "og" | "logo" | "favicon";

interface SiteSettingsDto {
  meta_title: string;
  meta_description: string;
  og_image_url: string;
  logo_url: string;
  favicon_url: string;
}

export function SiteSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<SiteAssetKind | null>(null);

  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");

  useEffect(() => {
    rpc<SiteSettingsDto>("adminGetSiteSettingsAction")
      .then((s) => {
        setMetaTitle(s.meta_title);
        setMetaDescription(s.meta_description);
        setOgImageUrl(s.og_image_url);
        setLogoUrl(s.logo_url);
        setFaviconUrl(s.favicon_url);
      })
      .catch(() => toast.error("Couldn't load site settings"))
      .finally(() => setLoading(false));
  }, []);

  const saveText = async () => {
    setSaving(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("adminSaveSiteSettingsAction", {
        meta_title: metaTitle,
        meta_description: metaDescription,
      });
      if (!res.ok) throw new Error(res.error || "Save failed");
      toast.success("Site settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const upload = async (kind: SiteAssetKind, file: File) => {
    setUploading(kind);
    try {
      const url = await uploadSiteAsset(kind, file);
      if (kind === "og") setOgImageUrl(url);
      if (kind === "logo") setLogoUrl(url);
      if (kind === "favicon") setFaviconUrl(url);
      toast.success("Uploaded — live on the next page load");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const remove = async (kind: SiteAssetKind) => {
    const patch =
      kind === "og" ? { og_image_url: "" } : kind === "logo" ? { logo_url: "" } : { favicon_url: "" };
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("adminSaveSiteSettingsAction", patch);
      if (!res.ok) throw new Error(res.error || "Failed");
      if (kind === "og") setOgImageUrl("");
      if (kind === "logo") setLogoUrl("");
      if (kind === "favicon") setFaviconUrl("");
      toast.success("Removed — the default is used again");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-8 grid place-items-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const AssetRow = ({
    kind, label, hint, url, wide,
  }: { kind: SiteAssetKind; label: string; hint: string; url: string; wide?: boolean }) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {url ? (
        <div className="flex items-center gap-3">
          <img
            src={url}
            alt={label}
            className={wide ? "h-24 w-auto max-w-56 rounded-md border object-cover bg-muted" : "size-14 rounded-md border object-cover bg-muted"}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => remove(kind)}>
            <X className="size-4 me-1" /> Remove
          </Button>
        </div>
      ) : (
        <Input
          type="file"
          accept="image/*"
          disabled={uploading !== null}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(kind, f);
            e.target.value = "";
          }}
        />
      )}
      {uploading === kind && <p className="text-xs text-muted-foreground">Uploading…</p>}
    </div>
  );

  return (
    <div className="rounded-xl border bg-card divide-y max-w-2xl">
      <div className="p-4">
        <div className="font-semibold flex items-center gap-2">
          <Globe className="size-4 text-primary" /> Site branding
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Controls how ucultra.com looks in browser tabs and how shared links preview
          on WhatsApp, Facebook and other platforms.
        </p>
      </div>

      <div className="p-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="site-title">Meta title</Label>
          <Input
            id="site-title"
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            placeholder="UCU — Free POS System for Your Business"
            maxLength={70}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="site-desc">Site description</Label>
          <Textarea
            id="site-desc"
            rows={2}
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            placeholder="UCU is a free point-of-sale system with inventory management and sales tracking."
            maxLength={200}
          />
        </div>
        <Button onClick={saveText} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>

      <div className="p-4 space-y-5">
        <div className="font-medium text-sm flex items-center gap-2">
          <ImageIcon className="size-4 text-primary" /> Images
        </div>
        <AssetRow
          kind="og"
          label="Share preview image (OG image)"
          hint="Shown when the site link is shared on WhatsApp/social. Recommended 1200×630 px, under 300 KB."
          url={ogImageUrl}
          wide
        />
        <AssetRow
          kind="logo"
          label="Logo"
          hint="Replaces the built-in brand mark across the web app. Square works best."
          url={logoUrl}
        />
        <AssetRow
          kind="favicon"
          label="Favicon"
          hint="Browser-tab icon. PNG or SVG, square (32×32 or larger)."
          url={faviconUrl}
        />
      </div>
    </div>
  );
}
