"use client";

/**
 * Today's day, date and a live time — in the shop's own date and time format
 * (Settings → Shop → Date & time). `compact` is the one-line chip in the app
 * header: "Thu 6:32 PM" from xl, with the date added from 2xl. The boxed
 * version sits on the dashboard until the header shows the date (below 2xl).
 *
 * ⚠️ The time is read only after mount: the server renders at its own moment
 * and timezone, so reading the clock during render is a hydration mismatch.
 * Until then an empty box of the same size holds the space, so the header
 * doesn't jump.
 *
 * ⚠️ COPIED VERBATIM into the desktop app (`src/components/TodayClock.tsx`).
 * Change both together.
 */
import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { fmtDate, fmtTime } from "@/lib/date-format";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TodayClock({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    // Ticks every second so the minute turns over on time, not up to a minute late.
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (compact) {
    return (
      // Fixed min-width holds the space before mount, so the header doesn't jump.
      <div
        className={`items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground whitespace-nowrap min-w-[5.5rem] 2xl:min-w-[11.5rem] ${className}`}
        aria-live="off"
        title={now ? `${WEEKDAYS[now.getDay()]}, ${fmtDate(now)}` : undefined}
      >
        <CalendarDays className="size-4 text-primary shrink-0" />
        {now && (
          <span className="tabular-nums">
            {/* The date only where the header has room for it (2xl); the day and time always. */}
            {SHORT_DAYS[now.getDay()]} <span className="hidden 2xl:inline">{fmtDate(now)} · </span>
            <span className="font-semibold text-foreground">{fmtTime(now)}</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border bg-card px-4 py-2 shadow-sm min-h-[3.5rem] min-w-[12rem] ${className}`}
      aria-live="off"
    >
      <CalendarDays className="size-5 text-primary shrink-0" />
      {now && (
        <div className="leading-tight">
          <div className="text-lg font-semibold tabular-nums">{fmtTime(now)}</div>
          <div className="text-xs text-muted-foreground">
            {WEEKDAYS[now.getDay()]}, {fmtDate(now)}
          </div>
        </div>
      )}
    </div>
  );
}
