// COPIED verbatim to the desktop (src/components/BarcodeStickerDialog.tsx) —
// the terminal passes `print` (main process) and drops the Next-only lint comment.

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  buildLabelPrintHtml, cleanLabelSize, DEFAULT_LABEL, LABEL_PRESETS, LABEL_ROTATE_KEY, labelKey, labelPageSize, readLabelSize, storeLabelSize,
  type LabelSize,
} from "@/lib/barcode-label";

interface Props {
  open: boolean;
  onClose: () => void;
  product: { name: string; sku: string | null; barcode: string | null };
  /**
   * How the page reaches the printer. `page` is the PAGE size (the label, or
   * the label on its side when rotated). Omitted: a hidden frame + the browser's print dialog.
   */
  print?: (html: string, page: LabelSize) => void | Promise<void>;
}

const CAPTION_KEY = "ucu.labelCaption";

function printInFrame(html: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", opacity: "0", pointerEvents: "none" });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) { iframe.remove(); return; }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => iframe.remove(), 60000);
}

/**
 * Barcode stickers for thermal label printers, one label per page at the
 * roll's own size. The barcode is drawn to a <canvas> and printed as a PNG —
 * this avoids SVG namespace issues when serializing into the print page.
 */
export const BarcodeStickerDialog = ({ open, onClose, product, print }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qty, setQty] = useState(1);
  const [dataUrl, setDataUrl] = useState<string>("");
  const [size, setSize] = useState<LabelSize>(DEFAULT_LABEL);
  const [custom, setCustom] = useState(false);
  const [customW, setCustomW] = useState(String(DEFAULT_LABEL.width));
  const [customH, setCustomH] = useState(String(DEFAULT_LABEL.height));
  const [caption, setCaption] = useState(false);
  const [rotate, setRotate] = useState(false);

  // localStorage only after mount (hydration).
  useEffect(() => {
    const s = readLabelSize();
    setSize(s);
    setCustom(!LABEL_PRESETS.some((p) => labelKey(p) === labelKey(s)));
    setCustomW(String(s.width));
    setCustomH(String(s.height));
    try {
      setCaption(localStorage.getItem(CAPTION_KEY) === "1");
      setRotate(localStorage.getItem(LABEL_ROTATE_KEY) === "1");
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!open || !product.barcode) {
      setDataUrl("");
      return;
    }
    const raf = requestAnimationFrame(() => {
      if (!canvasRef.current) return;
      try {
        // Drawn large and scaled down to the label: crisper bars than a small
        // canvas scaled up on a 203dpi head.
        JsBarcode(canvasRef.current, product.barcode!, {
          format: "CODE128",
          width: 3,
          height: 90,
          displayValue: true,
          fontSize: 22,
          margin: 6,
        });
        setDataUrl(canvasRef.current.toDataURL("image/png"));
      } catch {
        setDataUrl("");
        toast({
          title: "Could not generate barcode",
          description: "The barcode value is invalid.",
          variant: "destructive",
        });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [open, product.barcode]);

  const pickPreset = (v: string) => {
    if (v === "custom") {
      setCustom(true);
      return;
    }
    const p = LABEL_PRESETS.find((x) => labelKey(x) === v);
    if (!p) return;
    setCustom(false);
    setSize(p);
    setCustomW(String(p.width));
    setCustomH(String(p.height));
    storeLabelSize(p);
  };

  const setCustomSide = (w: string, h: string) => {
    setCustomW(w);
    setCustomH(h);
    const s = cleanLabelSize({ width: w, height: h });
    if (s) {
      setSize(s);
      storeLabelSize(s);
    }
  };
  const customBad = custom && !cleanLabelSize({ width: customW, height: customH });

  const toggleCaption = (on: boolean) => {
    setCaption(on);
    try { localStorage.setItem(CAPTION_KEY, on ? "1" : "0"); } catch { /* ignore */ }
  };

  const toggleRotate = (on: boolean) => {
    setRotate(on);
    try { localStorage.setItem(LABEL_ROTATE_KEY, on ? "1" : "0"); } catch { /* ignore */ }
  };

  const doPrint = async () => {
    if (!dataUrl || customBad) return;
    const html = buildLabelPrintHtml({ imageUrl: dataUrl, copies: qty, size, caption: caption ? product.name : null, rotate });
    try {
      if (print) await print(html, labelPageSize(size, rotate));
      else printInFrame(html);
    } catch (e) {
      toast({ title: "Could not print", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  // Preview at the label's own proportions, 4px per mm (capped to the dialog).
  const scale = Math.min(4, 240 / size.width);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Print barcode sticker</DialogTitle>
        </DialogHeader>

        {!product.barcode ? (
          <p className="text-sm text-muted-foreground">This product has no barcode yet.</p>
        ) : (
          <div className="space-y-4">
            {/* Drawn off-screen; the preview shows the PNG at the label's size. */}
            <canvas ref={canvasRef} className="hidden" />
            <div className="border rounded-lg p-4 flex items-center justify-center bg-muted/40">
              <div
                className="bg-white text-black shadow-sm border flex flex-col items-center justify-center overflow-hidden"
                style={{ width: size.width * scale, height: size.height * scale, padding: `${1.5 * scale}px ${2 * scale}px` }}
              >
                {caption && (
                  <div className="w-full text-center font-bold truncate leading-tight" style={{ fontSize: Math.max(8, scale * 2.8) }}>
                    {product.name}
                  </div>
                )}
                {dataUrl && (
                  <img src={dataUrl} alt="barcode" className="w-full min-h-0 flex-1 object-contain" />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Label size (W × H)</Label>
                <Select value={custom ? "custom" : labelKey(size)} onValueChange={pickPreset}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LABEL_PRESETS.map((p) => (
                      <SelectItem key={labelKey(p)} value={labelKey(p)}>{p.width} × {p.height} mm</SelectItem>
                    ))}
                    <SelectItem value="custom">Custom size…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Number of copies</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                />
              </div>
              {custom && (
                <>
                  <div className="space-y-1.5">
                    <Label>Width (mm)</Label>
                    <Input inputMode="decimal" value={customW} onChange={(e) => setCustomSide(e.target.value, customH)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Height (mm)</Label>
                    <Input inputMode="decimal" value={customH} onChange={(e) => setCustomSide(customW, e.target.value)} />
                  </div>
                  {customBad && <p className="col-span-2 text-xs text-destructive">Enter a size between 15 and 150 mm.</p>}
                </>
              )}
            </div>

            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Print product name above the barcode</span>
              <Switch checked={caption} onCheckedChange={toggleCaption} />
            </label>

            <label className="flex items-start justify-between gap-3 text-sm">
              <span>
                Rotate 90°
                <span className="block text-xs text-muted-foreground">
                  Turn on if the barcode prints sideways — running along the roll across two labels.
                </span>
              </span>
              <Switch checked={rotate} onCheckedChange={toggleRotate} />
            </label>

            <p className="text-xs text-muted-foreground">
              Measure one label on the roll (not counting the gap) and pick that size. In the print window choose the
              label printer, paper size {labelPageSize(size, rotate).width} × {labelPageSize(size, rotate).height} mm, margins <b>None</b>, scale <b>100%</b>, and
              turn off headers and footers.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button
            disabled={!dataUrl || customBad}
            onClick={doPrint}
            className="bg-gradient-primary hover:opacity-90 text-primary-foreground"
          >
            <Printer className="size-4 mr-2" /> Print {qty > 1 ? `${qty} stickers` : "sticker"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
