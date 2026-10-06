"use client";

/**
 * "What's new" — the platform's announcements as a feed you can scroll back
 * through, like a WhatsApp channel: a header button with a dot for anything
 * unread, and a pop-up card that opens by itself once for a notice posted as
 * a pop-up (a new feature with its picture or video).
 *
 * ⚠️ COPIED verbatim to the desktop app (`src/components/announcements/`).
 * Navigation comes in through `navigate`, since the two apps route differently.
 */
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDate } from "@/lib/date-format";
import { cn } from "@/lib/utils";
import type { ShopAnnouncementDto } from "@/lib/announcements";
import { announcementsApi } from "@/components/announcements/announcements-api";
import { AnnouncementMedia } from "@/components/announcements/AnnouncementMedia";

export function WhatsNew({ navigate }: { navigate: (href: string) => void }) {
  const [feed, setFeed] = useState<ShopAnnouncementDto[]>([]);
  const [open, setOpen] = useState(false);
  const [popup, setPopup] = useState<ShopAnnouncementDto | null>(null);

  const load = useCallback(async () => {
    try {
      const items = await announcementsApi.feed();
      setFeed(items);
      // One pop-up per load: the newest unread one posted as a pop-up.
      setPopup((p) => p ?? items.find((a) => a.style === "popup" && !a.read) ?? null);
    } catch {
      // Offline — the button simply shows nothing new.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = (ids: string[]) => {
    if (!ids.length) return;
    setFeed((f) => f.map((a) => (ids.includes(a.id) ? { ...a, read: true } : a)));
    for (const id of ids) void announcementsApi.markRead(id).catch(() => {});
  };

  const closePopup = () => {
    if (popup) markRead([popup.id]);
    setPopup(null);
  };

  const openFeed = () => {
    setOpen(true);
    // Seen in the feed counts as read — except a notice that may not be
    // dismissed (a maintenance warning), whose banner must stay up.
    markRead(feed.filter((a) => !a.read && a.dismissible).map((a) => a.id));
  };

  const unread = feed.filter((a) => !a.read).length;
  const go = (url: string) => {
    if (url.startsWith("/")) navigate(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <Button variant="ghost" size="icon" className="relative" onClick={openFeed} aria-label="What's new" title="What's new">
        <Sparkles className="size-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex size-2.5 rounded-full bg-primary ring-2 ring-background" />
        )}
      </Button>

      {/* The feed */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /> What&apos;s new</DialogTitle>
            <DialogDescription>New features, changes and news from UC Ultra.</DialogDescription>
          </DialogHeader>
          {feed.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nothing new right now.</p>
          ) : (
            <div className="space-y-4">
              {feed.map((a) => (
                <article key={a.id} className={cn("space-y-2 rounded-xl border p-3", !a.read && "border-primary/40 bg-primary/5")}>
                  <AnnouncementMedia type={a.media_type} url={a.media_url} />
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-snug">{a.title}</h3>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(a.created_at.slice(0, 10))}</span>
                  </div>
                  {a.body && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>}
                  {a.cta_label && a.cta_url && (
                    <Button size="sm" variant="outline" onClick={() => { setOpen(false); go(a.cta_url!); }}>
                      {a.cta_label} {!a.cta_url.startsWith("/") && <ExternalLink className="size-3.5 ms-1" />}
                    </Button>
                  )}
                </article>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* The pop-up for a new feature */}
      <Dialog open={!!popup && !open} onOpenChange={(v) => { if (!v) closePopup(); }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          {popup && (
            <>
              <AnnouncementMedia type={popup.media_type} url={popup.media_url} autoPlay className="rounded-b-none rounded-t-lg" />
              <div className="space-y-3 p-6">
                <DialogHeader>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                    <Sparkles className="size-3.5" /> What&apos;s new
                  </p>
                  <DialogTitle className="text-xl">{popup.title}</DialogTitle>
                  {popup.body && <DialogDescription className="whitespace-pre-wrap text-sm">{popup.body}</DialogDescription>}
                </DialogHeader>
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <Button variant={popup.cta_label ? "outline" : "default"} onClick={closePopup}>Got it</Button>
                  {popup.cta_label && popup.cta_url && (
                    <Button onClick={() => { const url = popup.cta_url!; closePopup(); go(url); }}>
                      {popup.cta_label}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
