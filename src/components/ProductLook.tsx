import { useRef, useState } from "react";
import { ImagePlus, Loader2, Palette, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PRODUCT_COLORS, compressProductImage, initialsOf, normalizeColor, textOn } from "@/lib/product-look";

/**
 * The product drawn small: its photo, else its colour with its initials, else
 * (with `placeholder`) a quiet grey tile so a column of them still lines up.
 * Returns nothing when there is neither and no placeholder was asked for.
 */
export function ProductThumb({
  name,
  imageUrl,
  color,
  className = "size-9",
  rounded = "rounded-md",
  placeholder = false,
  textClassName = "text-[11px]",
}: {
  name: string;
  imageUrl?: string | null;
  color?: string | null;
  /** Size (and anything else) — the tile fills it. */
  className?: string;
  rounded?: string;
  placeholder?: boolean;
  textClassName?: string;
}) {
  const [broken, setBroken] = useState(false);
  const hex = normalizeColor(color);
  if (imageUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tiny public blob images, no optimiser needed
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className={`${className} ${rounded} shrink-0 object-cover bg-muted border border-border/60`}
      />
    );
  }
  if (!hex && !placeholder) return null;
  return (
    <span
      aria-hidden
      className={`${className} ${rounded} ${textClassName} shrink-0 inline-flex items-center justify-center font-semibold select-none ${hex ? "" : "bg-muted text-muted-foreground"}`}
      style={hex ? { backgroundColor: hex, color: textOn(hex) } : undefined}
    >
      {initialsOf(name)}
    </span>
  );
}

/**
 * Product form field: upload a photo (compressed to WebP first) or pick a
 * colour. Either is optional; a photo wins where both are set, so picking a
 * colour while a photo is on offers to drop the photo.
 */
export function ProductLookField({
  name,
  imageUrl,
  color,
  onChange,
  upload,
}: {
  name: string;
  imageUrl: string | null | undefined;
  color: string | null | undefined;
  onChange: (patch: { image_url?: string | null; color?: string | null }) => void;
  /** Sends the compressed image to storage and returns its public URL. */
  upload: (file: Blob, fileName: string) => Promise<string>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const hex = normalizeColor(color);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
      toast.error("Choose an image file.");
      return;
    }
    setBusy(true);
    try {
      const small = await compressProductImage(file);
      const ext = small.type === "image/webp" ? "webp" : "jpg";
      const base = (file.name.replace(/\.[^.]+$/, "") || "product").slice(0, 40);
      const url = await upload(small, `${base}.${ext}`);
      onChange({ image_url: url });
      toast.success(`Image added (${Math.max(1, Math.round(small.size / 1024))} KB)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't upload the image.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>Image or colour <span className="font-normal text-muted-foreground">(optional)</span></Label>
      <div className="flex flex-col sm:flex-row gap-3 rounded-lg border bg-muted/20 p-3">
        <div className="flex items-center gap-3 sm:w-56 shrink-0">
          <ProductThumb
            name={name || "?"}
            imageUrl={imageUrl}
            color={hex}
            placeholder
            className="size-16"
            rounded="rounded-lg"
            textClassName="text-lg"
          />
          <div className="flex flex-col gap-1.5 min-w-0">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.heic,.heif"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              data-enter-skip
              onClick={() => fileRef.current?.click()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
              {busy ? "Uploading…" : imageUrl ? "Change image" : "Upload image"}
            </Button>
            {imageUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                data-enter-skip
                onClick={() => onChange({ image_url: null })}
              >
                <Trash2 className="size-4" /> Remove image
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="text-xs text-muted-foreground">
            {imageUrl ? "Or remove the image and use a colour instead:" : "No photo? Pick a colour to spot it at the till:"}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRODUCT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                data-enter-skip
                title={c}
                aria-label={`Colour ${c}`}
                aria-pressed={hex === c}
                onClick={() => onChange({ color: hex === c ? null : c, ...(imageUrl ? { image_url: null } : {}) })}
                className="size-7 rounded-md border border-black/10 inline-flex items-center justify-center transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ backgroundColor: c }}
              >
                {hex === c && <Check className="size-4" style={{ color: textOn(c) }} />}
              </button>
            ))}
            {/* Any other colour. */}
            <label
              title="Custom colour"
              className="relative size-7 rounded-md border inline-flex items-center justify-center cursor-pointer bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] hover:scale-110 transition-transform"
            >
              <Palette className="size-3.5 text-white drop-shadow" />
              <input
                type="color"
                data-enter-skip
                value={hex ?? "#6366f1"}
                onChange={(e) => onChange({ color: normalizeColor(e.target.value), ...(imageUrl ? { image_url: null } : {}) })}
                className="absolute inset-0 opacity-0 cursor-pointer"
                aria-label="Custom colour"
              />
            </label>
          </div>
          {hex && !imageUrl && (
            <button
              type="button"
              data-enter-skip
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              onClick={() => onChange({ color: null })}
            >
              Clear colour
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
