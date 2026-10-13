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

const readPos = (): CheckoutMode => readStoredAppearance().checkout;
const readReturn = (): CheckoutMode => readStoredAppearance().returnCheckout;
// The server can't see localStorage: each screen's long-standing layout.
const serverPos = (): CheckoutMode => "popup";
const serverReturn = (): CheckoutMode => "inline";

/** "pos" — the till; "return" — the new-return page. Set separately. */
export function useCheckoutMode(screen: "pos" | "return" = "pos"): CheckoutMode {
  return useSyncExternalStore(
    subscribe,
    screen === "return" ? readReturn : readPos,
    screen === "return" ? serverReturn : serverPos,
  );
}
