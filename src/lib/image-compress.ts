/**
 * Shrink an image in the browser before it is uploaded: longest side capped,
 * re-encoded as WebP (JPEG where the browser can't write WebP). A 4 MB phone
 * photo comes out at a few tens of KB. Browser only — it needs a canvas.
 * Pure otherwise, so the desktop can copy it verbatim.
 */
export async function compressImage(
  file: Blob,
  { maxSide = 480, quality = 0.82, background = "#ffffff" }: { maxSide?: number; quality?: number; background?: string | null } = {},
): Promise<Blob> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't resize images.");
  // WebP keeps transparency (a logo on a clear background); the JPEG fallback
  // can't, so it gets a solid background or transparent areas turn black.
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap.source, 0, 0, w, h);

  const webp = await toBlob(canvas, "image/webp", quality);
  // Safari before 17 silently hands back a PNG for a type it can't write.
  if (webp && webp.type === "image/webp") { bitmap.close(); return webp; }

  if (background) {
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
  }
  bitmap.close();
  const jpeg = await toBlob(canvas, "image/jpeg", quality);
  if (!jpeg) throw new Error("Couldn't compress that image.");
  return jpeg;
}

/** File extension for a compressed blob. */
export const compressedExt = (b: Blob) => (b.type === "image/webp" ? "webp" : "jpg");

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

interface Bitmap { source: CanvasImageSource; width: number; height: number; close: () => void }

async function loadBitmap(file: Blob): Promise<Bitmap> {
  if (typeof createImageBitmap === "function") {
    try {
      // Honour the phone's EXIF rotation, or portrait photos arrive sideways.
      const b = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: b, width: b.width, height: b.height, close: () => b.close() };
    } catch {
      /* fall through to <img>, which decodes a few formats createImageBitmap won't (SVG) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    // An SVG with no intrinsic size reports 0×0.
    const width = img.naturalWidth || 256;
    const height = img.naturalHeight || 256;
    return { source: img, width, height, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("That file isn't an image this browser can open.");
  }
}

/** Is this one of our own Vercel Blob uploads? Only those are saved as image URLs. */
export function isBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}
