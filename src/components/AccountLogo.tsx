import { useRef, useState } from "react";
import { Banknote, ImagePlus, Landmark, Loader2, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { compressImage, compressedExt } from "@/lib/image-compress";

const TYPE_ICON = { cash: Banknote, bank: Landmark, wallet: Wallet } as const;

/**
 * An account's mark: its uploaded logo, else the icon for its type. A logo
 * that fails to load falls back to the icon rather than a broken image.
 */
export function AccountLogo({
  logoUrl, type, className = "size-8",
}: { logoUrl?: string | null; type: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (logoUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tiny public blob image, no optimiser needed
      <img
        src={logoUrl}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className={`${className} shrink-0 rounded-md object-contain bg-white border border-border/60`}
      />
    );
  }
  const Icon = TYPE_ICON[type as keyof typeof TYPE_ICON] ?? Wallet;
  return (
    <span className={`${className} shrink-0 rounded-md bg-primary/10 text-primary inline-flex items-center justify-center`}>
      <Icon className="size-[55%]" />
    </span>
  );
}

/** Logo picker for the account form: compress to WebP, upload, hand back the URL. */
export function AccountLogoField({
  logoUrl, type, onChange, upload,
}: {
  logoUrl: string | null;
  type: string;
  onChange: (url: string | null) => void;
  upload: (file: Blob, fileName: string) => Promise<string>;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Choose an image file.");
    setBusy(true);
    try {
      // Logos are drawn at most ~48px; 256px covers sharp screens.
      const small = await compressImage(file, { maxSide: 256, quality: 0.85 });
      const base = (file.name.replace(/\.[^.]+$/, "") || "logo").slice(0, 40);
      onChange(await upload(small, `${base}.${compressedExt(small)}`));
      toast.success(`Logo added (${Math.max(1, Math.round(small.size / 1024))} KB)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't upload the logo.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>Logo <span className="font-normal text-muted-foreground">(optional)</span></Label>
      <div className="flex items-center gap-3">
        <AccountLogo logoUrl={logoUrl} type={type} className="size-12" />
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <Button type="button" variant="outline" size="sm" disabled={busy} data-enter-skip onClick={() => ref.current?.click()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {busy ? "Uploading…" : logoUrl ? "Change" : "Upload logo"}
        </Button>
        {logoUrl && !busy && (
          <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" data-enter-skip onClick={() => onChange(null)}>
            <Trash2 className="size-4" /> Remove
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">The bank&apos;s or wallet&apos;s logo, so it&apos;s easy to spot. Shrunk to a small WebP before upload.</p>
    </div>
  );
}
