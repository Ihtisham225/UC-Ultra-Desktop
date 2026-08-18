import { useEffect, useRef } from "react";
import { Bold, Italic, Underline, List, ListOrdered, RemoveFormatting } from "lucide-react";
import { sanitizeRichText } from "@/lib/rich-text";

interface Props {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
}

const BUTTONS = [
  { cmd: "bold", icon: Bold, label: "Bold" },
  { cmd: "italic", icon: Italic, label: "Italic" },
  { cmd: "underline", icon: Underline, label: "Underline" },
  { cmd: "insertUnorderedList", icon: List, label: "Bulleted list" },
  { cmd: "insertOrderedList", icon: ListOrdered, label: "Numbered list" },
  { cmd: "removeFormat", icon: RemoveFormatting, label: "Clear formatting" },
] as const;

/**
 * Small formatting box for shop-authored text (receipt terms). Deliberately
 * built on contenteditable + execCommand rather than an editor library: the
 * only formatting a thermal receipt can render is bold/italic/underline and
 * lists, and the desktop app would otherwise ship a megabyte to get it.
 */
export function RichTextEditor({ value, onChange, disabled, placeholder, rows = 5 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  /** The last HTML this editor emitted, so echoes of it are ignored. */
  const emitted = useRef<string | null>(null);

  /**
   * Writing innerHTML puts the caret back at the start, so it must happen only
   * for values that came from outside. Comparing against the DOM is not enough:
   * the sanitiser normalises what the browser produced (`<br>` becomes
   * `<br />`, whitespace is trimmed), so every keystroke came back looking
   * "different" and re-wrote the box mid-typing — which is why the cursor kept
   * jumping to the top, and why backspace sent it there again.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value === emitted.current) return;       // our own change, already shown
    if (value === el.innerHTML) return;
    el.innerHTML = value || "";
  }, [value]);

  const emit = (html: string) => {
    const clean = sanitizeRichText(html);
    emitted.current = clean;
    onChange(clean);
  };

  const exec = (cmd: string) => {
    if (disabled) return;
    ref.current?.focus();
    document.execCommand(cmd, false);
    if (ref.current) emit(ref.current.innerHTML);
  };

  const isEmpty = !value || value === "<br>" || value === "<div><br></div>";

  return (
    <div className={`rounded-md border ${disabled ? "opacity-60" : "focus-within:ring-1 focus-within:ring-ring"}`}>
      <div className="flex flex-wrap items-center gap-0.5 border-b p-1">
        {BUTTONS.map(({ cmd, icon: Icon, label }) => (
          <button
            key={cmd}
            type="button"
            title={label}
            aria-label={label}
            disabled={disabled}
            // Keep the selection: mousedown would blur the editable area first.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(cmd)}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none"
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
      <div className="relative">
        {isEmpty && placeholder && (
          <span className="pointer-events-none absolute start-3 top-2 text-sm text-muted-foreground whitespace-pre-line">
            {placeholder}
          </span>
        )}
        <div
          ref={ref}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={(e) => emit((e.target as HTMLDivElement).innerHTML)}
          // Paste as plain text so formatting from Word or a web page cannot
          // drag in markup the receipt can't print.
          onPaste={(e) => {
            e.preventDefault();
            const text = e.clipboardData.getData("text/plain");
            document.execCommand("insertText", false, text);
          }}
          className="w-full overflow-y-auto px-3 py-2 text-sm outline-none [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:ps-5 [&_ol]:ps-5"
          style={{ minHeight: `${rows * 1.5}rem`, maxHeight: "16rem" }}
        />
      </div>
    </div>
  );
}
