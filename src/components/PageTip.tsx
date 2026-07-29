import { type ReactNode } from "react";

/**
 * Page tips were removed at the shop owners' request. Kept as a no-op so the
 * existing call sites don't need to change.
 */
export function PageTip(_: { id: string; title: string; children: ReactNode }) {
  return null;
}
