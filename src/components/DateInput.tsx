"use client";

/**
 * A date box that reads and writes the shop's date format (Settings → Shop →
 * Date & time) — a drop-in for `<Input type="date">`.
 *
 * A native date input can't do this: it draws the date in the COMPUTER's
 * locale, whatever the shop chose. So this is a text box the counter types
 * into (separators go in by themselves), with a calendar button that opens the
 * browser's own picker from a hidden native input.
 *
 * The value in and out is still yyyy-MM-dd ("" for empty) and `onChange`
 * still hands back `e.target.value`, so call sites swap the tag and nothing
 * else. It only reports a value once the text is a whole, real date — the
 * same guarantee the old `/^\d{4}-\d{2}-\d{2}$/` checks were written for.
 *
 * ⚠️ COPIED to the desktop app (`src/components/DateInput.tsx`).
 */
import * as React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { autoSeparate, inputPattern, inputToIso, isoToInput } from "@/lib/date-format";

type DateChange = { target: { value: string } };

/** Classes that size or place the box belong on the wrapper; the rest style the text box. */
const LAYOUT = /^(?:[a-z]+:)?(?:(?:min-|max-)?w-|shrink|grow|flex-|basis-|col-span|self-|m[trblxyse]?-)/;
function splitClasses(className?: string): { outer: string; inner: string } {
  const outer: string[] = [];
  const inner: string[] = [];
  for (const c of (className ?? "").split(/\s+/).filter(Boolean)) (LAYOUT.test(c) ? outer : inner).push(c);
  return { outer: outer.join(" "), inner: inner.join(" ") };
}

export interface DateInputProps
  extends Omit<React.ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange"> {
  value: string | null | undefined;
  onChange?: (e: DateChange) => void;
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ value, onChange, className, min, max, disabled, onBlur, placeholder, ...rest }, ref) => {
    const iso = value ?? "";
    const [text, setText] = React.useState(() => isoToInput(iso));
    const picker = React.useRef<HTMLInputElement>(null);
    const { placeholder: pattern } = inputPattern();
    const cls = splitClasses(className);

    // Follow a value set from outside (a reset, a quick-range button, a
    // pre-filled form) — but not while the text already means that value, or
    // a half-edited "3/9/2026" would be snapped to "03/09/2026" mid-typing.
    React.useEffect(() => {
      setText((t) => (inputToIso(t) === iso || (iso === "" && t.trim() === "") ? t : isoToInput(iso)));
    }, [iso]);

    const emit = (next: string) => {
      if (next !== iso) onChange?.({ target: { value: next } });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value.replace(/[^\d/\-. ]/g, "");
      const deleting = (e.nativeEvent as InputEvent).inputType?.startsWith("delete");
      // Re-separate plain digit runs as they're typed. Leave the text alone
      // when deleting (or the separator would come straight back) and when
      // someone typed a one-digit part with their own separator ("3/9/…").
      if (!deleting && !/(^|\D)\d(\D)/.test(raw)) {
        raw = autoSeparate(raw.replace(/\D/g, "").slice(0, 8));
      }
      setText(raw);
      if (raw.trim() === "") return emit("");
      const parsed = inputToIso(raw);
      if (parsed) emit(parsed);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Leaving the box tidies it: a whole date is shown in the shop's
      // format, anything else goes back to the last good value.
      const parsed = inputToIso(text);
      if (parsed) setText(isoToInput(parsed));
      else if (text.trim() === "") emit("");
      else setText(isoToInput(iso));
      onBlur?.(e);
    };

    const openPicker = () => {
      const el = picker.current;
      if (!el || disabled) return;
      try {
        el.showPicker();
      } catch {
        el.focus();
        el.click();
      }
    };

    return (
      <div className={cn("relative w-full", cls.outer)}>
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder ?? pattern}
          className={cn(
            "flex h-11 w-full rounded-md border border-input bg-background ps-3.5 pe-10 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-[15px] tabular-nums",
            cls.inner,
          )}
          {...rest}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Pick a date"
          onClick={openPicker}
          disabled={disabled}
          className="absolute inset-y-0 end-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <CalendarDays className="size-4" />
        </button>
        {/* The browser's own calendar, opened by the button. Never focused by
            the keyboard and never seen — only its popup is. */}
        <input
          ref={picker}
          type="date"
          tabIndex={-1}
          aria-hidden
          value={/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : ""}
          min={min}
          max={max}
          onChange={(e) => {
            setText(isoToInput(e.target.value));
            emit(e.target.value);
          }}
          className="pointer-events-none absolute bottom-0 end-0 h-0 w-9 opacity-0"
        />
      </div>
    );
  },
);
DateInput.displayName = "DateInput";
