/**
 * How the shared announcement pieces reach the server. Only this file differs
 * between the apps: on the web the server actions, here `rpc()`.
 */
import { rpc } from "@/lib/apiClient";
import type { ShopAnnouncementDto } from "@/lib/announcements";

export const announcementsApi = {
  unread: () => rpc<ShopAnnouncementDto[]>("listMyAnnouncementsAction"),
  feed: () => rpc<ShopAnnouncementDto[]>("listWhatsNewAction"),
  markRead: (id: string) => rpc<{ ok: true }>("dismissAnnouncementAction", id),
};
