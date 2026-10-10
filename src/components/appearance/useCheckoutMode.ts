"use client";

/**
 * This person's POS checkout layout (Settings → Appearance → Till checkout).
 * Read from the stored appearance, and kept live: changing it in Settings, or
 * the account's copy arriving via AppearanceSync, re-renders the till.
 *
 * ⚠️ COPIED verbatim to the desktop app (`src/components/appearance/`).
 */
import { useSyncExternalStore } from "react";
import { APPEARANCE_EVENT, readStoredAppearance, type CheckoutMode } from "@/lib/appearance";

function subscribe(cb: () => void) {
  window.addEventListener(APPEARANCE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(APPEARANCE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

const read = (): CheckoutMode => readStoredAppearance().checkout;
// The server can't see localStorage; the pop-up layout is the long-standing default.
const serverRead = (): CheckoutMode => "popup";

export function useCheckoutMode(): CheckoutMode {
  return useSyncExternalStore(subscribe, read, serverRead);
}
