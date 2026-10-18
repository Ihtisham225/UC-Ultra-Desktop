/**
 * The shapes the shop side of announcements works with. Types only, so the
 * desktop can hold a verbatim copy without the server module.
 * ⚠️ COPIED verbatim to the desktop app (`src/lib/announcements.ts`).
 */

/**
 * "gif" is its own choice in the admin form (a short looping how-to), but a
 * browser shows it exactly like a picture — see shopMediaType.
 */
export type MediaType = "image" | "video" | "youtube" | "gif";

/** How the admin side names each kind. */
export const MEDIA_LABELS: Record<MediaType, string> = {
  image: "Picture",
  video: "Video",
  youtube: "YouTube",
  gif: "GIF",
};

/**
 * What the shop side is sent. A GIF goes out as "image": terminals released
 * before GIFs existed only know image / video / youtube and would otherwise
 * drop the media altogether — and an <img> plays a GIF on its own anyway.
 */
export const shopMediaType = (t: string | null): Exclude<MediaType, "gif"> | null =>
  t === "gif" ? "image" : ((t as Exclude<MediaType, "gif"> | null) ?? null);

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
