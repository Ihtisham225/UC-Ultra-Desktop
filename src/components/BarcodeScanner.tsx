import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export const BarcodeScanner = ({ open, onClose, onDetected }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;
    let primingStream: MediaStream | null = null;

    (async () => {
      // Pre-flight checks
      if (typeof window !== "undefined" && !window.isSecureContext) {
        setError("Camera requires HTTPS. Please open this app over a secure connection.");
        toast.error("Camera needs HTTPS");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser does not support camera access. Try Chrome or Safari.");
        toast.error("Camera not supported in this browser");
        return;
      }

      try {
        // 1) Explicitly request camera permission FIRST. This triggers the
        //    browser prompt and also unlocks device labels for enumeration.
        primingStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (cancelled) {
          primingStream.getTracks().forEach((t) => t.stop());
          return;
        }

        // 2) Now enumerate – labels will be populated.
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const deviceId =
          devices.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ??
          devices[0]?.deviceId;

        // Stop the priming stream – ZXing will open its own.
        primingStream.getTracks().forEach((t) => t.stop());
        primingStream = null;

        if (!deviceId) throw new Error("No camera available on this device");

        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current!,
          (result) => {
            if (result && !cancelled) {
              onDetected(result.getText());
              controls.stop();
              onClose();
            }
          },
        );
        controlsRef.current = controls;
      } catch (e: any) {
        const name = e?.name as string | undefined;
        let msg = e?.message ?? "Could not start camera";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          msg = "Camera permission was blocked. Enable it for this site in your browser settings, then reopen the scanner.";
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          msg = "No camera was found on this device.";
        } else if (name === "NotReadableError") {
          msg = "Camera is being used by another app. Close it and try again.";
        } else if (name === "SecurityError") {
          msg = "Camera blocked for security reasons. Make sure you're on HTTPS.";
        }
        setError(msg);
        toast.error(msg);
      }
    })();

    return () => {
      cancelled = true;
      try {
        primingStream?.getTracks().forEach((t) => t.stop());
      } catch {}
      controlsRef.current?.stop();
    };
  }, [open, onClose, onDetected]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Camera className="size-4" /> Scan barcode</DialogTitle>
        </DialogHeader>
        {error ? (
          <div className="aspect-video flex items-center justify-center bg-muted rounded-lg text-sm text-muted-foreground p-4 text-center">
            {error}
          </div>
        ) : (
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
            <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-px bg-primary shadow-glow" />
          </div>
        )}
        <Button variant="outline" onClick={onClose}><X className="size-4 mr-2" /> Close</Button>
      </DialogContent>
    </Dialog>
  );
};
