import { useEffect, useState } from "react";
import { MonitorSmartphone, Globe } from "lucide-react";

/**
 * Which build the user is actually on, shown to everyone who can open
 * Settings. Support questions about the desktop app are unanswerable without
 * it — "update the app" means nothing if nobody can see what they are running.
 *
 * Desktop reports the installed app version from the main process. The web app
 * has no meaningful package version (it is always whatever is deployed), so it
 * reports the build's commit instead.
 */
export function AppVersionBadge() {
  const [desktopVersion, setDesktopVersion] = useState<string | null>(null);

  useEffect(() => {
    const api = (window as { electronAPI?: { getAppVersion?: () => Promise<string> } }).electronAPI;
    api?.getAppVersion?.().then(setDesktopVersion).catch(() => {});
  }, []);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
      {desktopVersion ? (
        <>
          <MonitorSmartphone className="size-3.5" />
          Desktop app v{desktopVersion}
        </>
      ) : (
        <>
          <Globe className="size-3.5" />
          Web app
        </>
      )}
    </span>
  );
}
