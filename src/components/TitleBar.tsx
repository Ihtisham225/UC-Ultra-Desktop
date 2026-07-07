/**
 * Invisible full-width drag strip pinned to the very top of the window.
 * Rendered on every screen (auth included) so the window can always be
 * dragged / double-clicked to zoom from the same predictable spot.
 * macOS-only: Windows/Linux keep the native window frame.
 */
export function isMacDesktop() {
  return typeof window !== "undefined" && window.electronAPI?.platform === "darwin";
}

export function TitleBar() {
  if (!isMacDesktop()) return null;
  return <div className="drag-region fixed top-0 inset-x-0 h-6 z-50" aria-hidden="true" />;
}
