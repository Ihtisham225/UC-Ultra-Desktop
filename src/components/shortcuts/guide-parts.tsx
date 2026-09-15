import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/** Building blocks the shortcut guides share, so every sheet reads the same. */

export const Key = ({ children }: { children: ReactNode }) => (
  <kbd className="inline-flex min-w-7 items-center justify-center rounded-md border bg-muted px-2 py-0.5 font-mono text-xs font-medium shadow-sm">
    {children}
  </kbd>
);

export function Row({ keys, action, detail }: { keys: ReactNode; action: string; detail?: string }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:w-44">{keys}</div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{action}</div>
        {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
      </div>
    </div>
  );
}

export function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <Card className="shadow-card p-6">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="mt-2 divide-y">{children}</div>
    </Card>
  );
}

export const Arrow = () => <span className="text-muted-foreground">→</span>;
