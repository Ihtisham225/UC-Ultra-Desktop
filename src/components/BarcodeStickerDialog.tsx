import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Printer } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  product: { name: string; sku: string | null; barcode: string | null };
}

/**
 * Pure barcode sticker for thermal label printers (50×30 mm).
 * Renders to a <canvas> and prints the barcode as a PNG image — this avoids
 * SVG namespace issues when serializing into a new print window.
 */
export const BarcodeStickerDialog = ({ open, onClose, product }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qty, setQty] = useState(1);
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    if (!open || !product.barcode) {
      setDataUrl("");
      return;
    }
    const raf = requestAnimationFrame(() => {
      if (!canvasRef.current) return;
      try {
        JsBarcode(canvasRef.current, product.barcode!, {
          format: "CODE128",
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 14,
          margin: 4,
        });
        setDataUrl(canvasRef.current.toDataURL("image/png"));
      } catch (e) {
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

  const print = () => {
    if (!dataUrl) return;
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) return;
    const stickers = Array.from({ length: qty })
      .map(() => `<div class="sticker"><img src="${dataUrl}" alt="barcode" /></div>`)
      .join("");

    win.document.write(`<!doctype html><html><head><title>Barcode</title>
      <style>
        @page { size: 50mm 30mm; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: -apple-system, system-ui, sans-serif; }
        .sticker {
          width: 50mm; height: 30mm; padding: 1mm;
          display: flex; align-items: center; justify-content: center;
          page-break-after: always; overflow: hidden;
        }
        .sticker img {
          width: auto; height: 100%; max-width: 100%;
          display: block; image-rendering: crisp-edges;
        }
      </style></head><body>${stickers}
      <script>
        const img = document.querySelector('img');
        const go = () => { window.print(); setTimeout(() => window.close(), 300); };
        if (img && !img.complete) img.onload = go; else go();
      </script>
      </body></html>`);
    win.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Print barcode sticker</DialogTitle>
        </DialogHeader>

        {!product.barcode ? (
          <p className="text-sm text-muted-foreground">This product has no barcode yet.</p>
        ) : (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 flex items-center justify-center bg-card">
              <canvas ref={canvasRef} />
            </div>

            <div className="space-y-1.5">
              <Label>Number of copies</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
              />
              <p className="text-xs text-muted-foreground">
                Sticker size: 50 × 30 mm. Compatible with thermal label printers.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button
            disabled={!dataUrl}
            onClick={print}
            className="bg-gradient-primary hover:opacity-90 text-primary-foreground"
          >
            <Printer className="size-4 mr-2" /> Print {qty > 1 ? `${qty} stickers` : "sticker"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
