"use client";

/**
 * The picture or video on an announcement: an uploaded image, an uploaded
 * video, or a YouTube link (embedded).
 *
 * ⚠️ COPIED verbatim to the desktop app (`src/components/announcements/`).
 */
import { cn } from "@/lib/utils";

/** The video id of a YouTube link (watch, youtu.be, shorts or embed), if it is one. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/);
      if (m) return m[1];
    }
  } catch {
    // Not a URL at all.
  }
  return null;
}

export function AnnouncementMedia({
  type,
  url,
  className,
  autoPlay = false,
}: {
  type: "image" | "video" | "youtube" | null;
  url: string | null;
  className?: string;
  autoPlay?: boolean;
}) {
  if (!type || !url) return null;
  if (type === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- remote, any size; next/image would need every host configured
    return <img src={url} alt="" className={cn("w-full rounded-lg object-cover", className)} loading="lazy" />;
  }
  if (type === "video") {
    return (
      <video
        src={url}
        controls
        playsInline
        muted={autoPlay}
        autoPlay={autoPlay}
        className={cn("w-full rounded-lg bg-black", className)}
      />
    );
  }
  const id = youtubeId(url);
  if (!id) return null;
  return (
    <div className={cn("relative w-full overflow-hidden rounded-lg bg-black pt-[56.25%]", className)}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`}
        title="Video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
