import { useSyncExternalStore } from "react";

// The platform never changes while the page is open, so there is nothing to
// subscribe to.
const subscribe = () => () => {};
const onClient = () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
const onServer = () => false;

/**
 * Whether the keyboard in front of the counter is a Mac's, so shortcut hints
 * read ⌘P rather than Ctrl+P.
 *
 * `useSyncExternalStore` rather than a state set in an effect: the server
 * snapshot (false) is used while hydrating, so there is no mismatch, and React
 * switches to the real value straight after — without the extra render a
 * setState-in-effect costs.
 */
export function useIsMac(): boolean {
  return useSyncExternalStore(subscribe, onClient, onServer);
}
