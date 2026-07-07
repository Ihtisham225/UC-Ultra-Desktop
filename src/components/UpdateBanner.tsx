import { useEffect, useState } from "react";
import { ArrowRight, RefreshCw, Download } from "lucide-react";

/**
 * Floating "Relaunch to update" pill (bottom-right), shown when
 * electron-updater has finished downloading a new version in the
 * background. Clicking it quits and installs immediately.
 */
export function UpdateBanner() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [ready, setReady] = useState<string | null>(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    api.onUpdateAvailable?.((version) => setDownloading(version));
    api.onUpdateDownloaded?.((version) => {
      setDownloading(null);
      setReady(version);
    });
  }, []);

  if (ready) {
    return (
      <button
        onClick={() => window.electronAPI?.installUpdate?.()}
        className="no-drag-region fixed bottom-5 right-5 z-[100] flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-lg hover:shadow-xl hover:bg-accent/30 transition-all text-start animate-in slide-in-from-bottom-4"
      >
        <RefreshCw className="size-5 shrink-0 text-primary" />
        <span className="leading-tight">
          <span className="block font-bold text-sm">Relaunch to update</span>
          <span className="block text-xs text-muted-foreground">v{ready}</span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground rtl-flip" />
      </button>
    );
  }

  if (downloading) {
    return (
      <div className="no-drag-region fixed bottom-5 right-5 z-[100] flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-lg text-start animate-in slide-in-from-bottom-4">
        <Download className="size-5 shrink-0 text-primary animate-pulse" />
        <span className="leading-tight">
          <span className="block font-bold text-sm">Downloading update…</span>
          <span className="block text-xs text-muted-foreground">v{downloading}</span>
        </span>
      </div>
    );
  }

  return null;
}
