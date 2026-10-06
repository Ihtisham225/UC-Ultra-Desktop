"use client";

/**
 * Locks a private page: until a code is entered the page itself isn't even
 * mounted, so it never fetches its figures. Also exports the small pieces a
 * screen uses to hide a single figure.
 *
 * ⚠️ COPIED verbatim to the desktop app (`src/components/security/`).
 */
import type { ReactNode } from "react";
import { Eye, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { privatePageFor } from "@/lib/privacy";
import { usePrivacy } from "@/components/security/PrivacyProvider";

export function PrivateGate({ pathname, children }: { pathname: string; children: ReactNode }) {
  const { isLocked, unlock, mfaEnabled } = usePrivacy();
  const page = privatePageFor(pathname);
  // Until we know what's private, a page that COULD be private isn't mounted —
  // otherwise it would fetch its figures in the moment before the lock lands.
  if (page && mfaEnabled === null) return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!page || !isLocked(page.key)) return <>{children}</>;
  return (
    <div className="mx-auto max-w-md py-16">
      <Card className="p-8 text-center space-y-4">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="size-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{page.label} is private</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the code from your authenticator app to see it. It locks again when you leave this page.
          </p>
        </div>
        <Button onClick={() => void unlock(page.key, page.label)}>
          <Lock className="size-4 me-1.5" /> Unlock with code
        </Button>
      </Card>
    </div>
  );
}

/** The dots a hidden figure shows in place of its value. */
export const MASK = "••••••";

/** A small "show" button for a hidden figure. */
export function RevealButton({ onClick, label = "Show" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/10"
      title="Enter your code to see this"
    >
      <Eye className="size-3.5" /> {label}
    </button>
  );
}
