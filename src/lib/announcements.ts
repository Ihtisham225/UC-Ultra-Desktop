/**
 * The shapes the shop side of announcements works with. Types only, so the
 * desktop can hold a verbatim copy without the server module.
 * ⚠️ COPIED verbatim to the desktop app (`src/lib/announcements.ts`).
 */

export type MediaType = "image" | "video" | "youtube";

export interface ShopAnnouncementDto {
  id: string;
  title: string;
  body: string;
  severity: "info" | "notice" | "warning" | "critical";
  dismissible: boolean;
  created_at: string;
  style: "banner" | "popup";
  media_type: MediaType | null;
  media_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  /** In the "What's new" feed: whether this person has already seen it. */
  read?: boolean;
}
