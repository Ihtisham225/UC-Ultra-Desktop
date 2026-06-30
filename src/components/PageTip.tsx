import { useEffect, useState, type ReactNode } from "react";
import { Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Inline, dismissible "did you know" tip card.
 * Dismissal is remembered in localStorage so users only see each tip once.
 */
export function PageTip({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const key = `ucu.tip.${id}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try { setDismissed(localStorage.getItem(key) === "1"); } catch {}
  }, [key]);

  if (dismissed) return null;

  const close = () => {
    try { localStorage.setItem(key, "1"); } catch {}
    setDismissed(true);
  };

  return (
    <div className="relative rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent p-4 pe-12">
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Lightbulb className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-primary font-bold">Tip</div>
          <div className="font-semibold leading-tight mt-0.5">{title}</div>
          <div className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{children}</div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 end-2 size-7 text-muted-foreground"
        onClick={close}
        aria-label="Dismiss tip"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
