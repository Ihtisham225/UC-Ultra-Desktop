import { useEffect, useState } from "react";
import { ArrowRight, RefreshCw, Download } from "lucide-react";
import type { UpdateState } from "@/hooks/useThermalPrinter";

/**
 * Floating update pill (bottom-right): "Downloading update…" while
 * electron-updater pulls the new version in the background, then "Relaunch to
 * update" once it is on disk. Clicking it quits and installs immediately.
 *
 * State is read from the main process on mount as well as listened for. The
 * updater starts before React does, and a cached update finishes downloading
 * almost instantly, so relying on the events alone meant the pill was
 * routinely missed.
 */
export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    api.getUpdateState?.().then(setState).catch(() => {});
    api.onUpdateState?.(setState);
  }, []);

  if (state.status === "downloaded") {
    return (
      <button
        onClick={() => window.electronAPI?.installUpdate?.()}
        className="no-drag-region fixed bottom-5 right-5 z-[100] flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-lg hover:shadow-xl hover:bg-accent/30 transition-all text-start animate-in slide-in-from-bottom-4"
      >
        <RefreshCw className="size-5 shrink-0 text-primary" />
        <span className="leading-tight">
          <span className="block font-bold text-sm">Relaunch to update</span>
          <span className="block text-xs text-muted-foreground">v{state.version}</span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground rtl-flip" />
      </button>
    );
  }

  if (state.status === "available") {
    return (
      <div className="no-drag-region fixed bottom-5 right-5 z-[100] flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-lg text-start animate-in slide-in-from-bottom-4">
        <Download className="size-5 shrink-0 text-primary animate-pulse" />
        <span className="leading-tight">
          <span className="block font-bold text-sm">Downloading update…</span>
          <span className="block text-xs text-muted-foreground">
            v{state.version}{state.percent ? ` · ${state.percent}%` : ""}
          </span>
        </span>
      </div>
    );
  }

  return null;
}
