/**
 * How the shared appearance pieces reach the server. Only this file differs
 * between the apps: on the web the server actions, here `rpc()`.
 */
import { rpc } from "@/lib/apiClient";
import type { Appearance } from "@/lib/appearance";

export const appearanceApi = {
  load: () => rpc<Appearance>("getAppearanceAction"),
  save: (a: Appearance) => rpc<{ ok: true; appearance: Appearance }>("saveAppearanceAction", a),
};
