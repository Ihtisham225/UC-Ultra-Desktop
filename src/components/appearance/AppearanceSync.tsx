"use client";

/**
 * Keeps this computer's copy of the person's look in step with their account.
 *
 * The local copy is applied before the first paint (no flash); once the page
 * is up, the account's copy is fetched and, if it differs — they changed it on
 * another computer — applied and stored. Renders nothing.
 *
 * ⚠️ COPIED verbatim to the desktop app (`src/components/appearance/`).
 */
import { useEffect } from "react";
import {
  applyAppearance,
  normalizeAppearance,
  readStoredAppearance,
  sameAppearance,
  storeAppearance,
} from "@/lib/appearance";
import { appearanceApi } from "@/components/appearance/appearance-api";

export function AppearanceSync({ userId }: { userId: string | null | undefined }) {
  useEffect(() => {
    // Apply the local copy at once (the desktop has no pre-paint script).
    applyAppearance(readStoredAppearance());
    if (!userId) return;
    let cancelled = false;
    appearanceApi
      .load()
      .then((remote) => {
        if (cancelled) return;
        const next = normalizeAppearance(remote);
        if (!sameAppearance(next, readStoredAppearance())) {
          storeAppearance(next);
          applyAppearance(next);
        }
      })
      // Offline or signed out: the local copy stands.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);
  return null;
}
