"use client";

/**
 * Today's day, date and a live time for the top of the dashboard — in the
 * shop's own date and time format (Settings → Shop → Date & time).
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

export default function TodayClock({ className = "" }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    // Ticks every second so the minute turns over on time, not up to a minute late.
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

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
