import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import type { UpdateState } from "@/hooks/useThermalPrinter";

/**
 * "Check for updates" with the updater's actual answer next to it. Until this
 * existed a failed check was indistinguishable from being up to date, so a
 * broken update channel could sit unnoticed for weeks.
 */
export function AppUpdateCard() {
  const [version, setVersion] = useState<string>("");
  const [state, setState] = useState<UpdateState>({ status: "idle" });
  const [checking, setChecking] = useState(false);

  const isDesktop = typeof window !== "undefined" && !!window.electronAPI;

  useEffect(() => {
    if (!isDesktop) return;
    window.electronAPI!.getAppVersion?.().then(setVersion).catch(() => {});
    window.electronAPI!.getUpdateState?.().then(setState).catch(() => {});
    window.electronAPI!.onUpdateState?.(setState);
  }, [isDesktop]);

  if (!isDesktop) return null;

  const check = async () => {
    setChecking(true);
    try {
      setState(await (window.electronAPI!.checkForUpdates?.() ?? Promise.resolve<UpdateState>({ status: "idle" })));
    } finally {
      setChecking(false);
    }
  };

  const line = () => {
    switch (state.status) {
      case "checking": return "Checking…";
      case "available": return `Downloading v${state.version}${state.percent ? ` — ${state.percent}%` : ""}`;
      case "downloaded": return `v${state.version} ready — relaunch to finish`;
      case "none": return "You are on the latest version.";
      case "error": return `Update check failed: ${state.message}`;
      default: return "";
    }
  };

  return (
    <Card className="shadow-card p-6 space-y-3 mt-4">
      <h3 className="font-semibold">App updates</h3>
      <p className="text-sm text-muted-foreground">
        Installed version {version ? `v${version}` : "—"}. Updates install in the background and
        apply when you relaunch.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={check} disabled={checking}>
          <RefreshCw className={`size-3.5 mr-1.5 ${checking ? "animate-spin" : ""}`} />
          Check for updates
        </Button>
        {state.status === "downloaded" && (
          <Button onClick={() => window.electronAPI?.installUpdate?.()}>Relaunch now</Button>
        )}
        <span className={`text-sm ${state.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {line()}
        </span>
      </div>
    </Card>
  );
}
