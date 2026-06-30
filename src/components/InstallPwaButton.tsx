import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

// Captures the Android/Chrome `beforeinstallprompt` event so we can show
// a manual "Install" button. iOS Safari does not fire this event — users
// must use Share → "Add to Home Screen" themselves.
type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export const InstallPwaButton = ({ className }: { className?: string }) => {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Already running as installed PWA — hide the button.
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) setInstalled(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  return (
    <Button
      size="sm"
      variant="outline"
      className={className}
      onClick={async () => {
        try {
          await deferred.prompt();
          await deferred.userChoice;
        } finally {
          setDeferred(null);
        }
      }}
    >
      <Download className="size-3.5 mr-1" /> Install
    </Button>
  );
};
