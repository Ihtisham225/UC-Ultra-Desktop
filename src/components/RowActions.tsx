/**
 * A table row's actions: the one or two the counter uses all day stay as
 * buttons, everything else sits behind a "⋯" menu with its name written out.
 *
 * Rows used to carry five or six identical grey icons each, which was most of
 * what made the lists look busy — and an icon you only use once a month is
 * better as a labelled menu item than a guess.
 *
 * - `inline` actions show as icon buttons (title = tooltip), in order.
 * - The rest go in the menu; destructive ones are moved to the bottom, in red,
 *   below a separator, so Delete is never the first thing under the cursor.
 * - `hidden` drops an action entirely (permissions, store type) without the
 *   caller having to build the array conditionally.
 *
 * ⚠️ COPIED VERBATIM into the desktop app (`src/components/RowActions.tsx`).
 * Change both together.
 */
import type { ComponentType } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface RowAction {
  /** Written out in the menu, and the tooltip when shown inline. */
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  /** Delete and the like: red, and always last in the menu. */
  destructive?: boolean;
  /** Extra classes for the inline button (e.g. a WhatsApp green). */
  className?: string;
  disabled?: boolean;
  hidden?: boolean;
}

export function RowActions({
  actions,
  inline = 2,
  className = "",
}: {
  actions: RowAction[];
  /** How many of the (visible) actions show as buttons before the menu. */
  inline?: number;
  className?: string;
}) {
  const shown = actions.filter((a) => !a.hidden);
  const head = shown.slice(0, inline);
  const rest = shown.slice(inline);
  // A menu holding a single item is just a slower button.
  const buttons = rest.length === 1 ? shown : head;
  const menu = rest.length === 1 ? [] : rest;
  const plain = menu.filter((a) => !a.destructive);
  const danger = menu.filter((a) => a.destructive);

  return (
    <div className={`flex items-center justify-end gap-0.5 ${className}`}>
      {buttons.map((a) => (
        <Button
          key={a.label}
          type="button"
          variant="ghost"
          size="icon"
          className={`size-8 ${a.destructive ? "text-destructive" : ""} ${a.className ?? ""}`}
          title={a.label}
          aria-label={a.label}
          disabled={a.disabled}
          onClick={a.onClick}
        >
          <a.icon className="size-4" />
        </Button>
      ))}
      {menu.length > 0 && (
        // Non-modal: most items open a dialog, and a modal menu handing focus
        // to a modal dialog can leave the page unclickable (a Radix quirk).
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="size-8" title="More actions" aria-label="More actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {plain.map((a) => (
              <DropdownMenuItem key={a.label} disabled={a.disabled} onSelect={() => a.onClick()}>
                <a.icon className="size-4 me-2 text-muted-foreground" /> {a.label}
              </DropdownMenuItem>
            ))}
            {plain.length > 0 && danger.length > 0 && <DropdownMenuSeparator />}
            {danger.map((a) => (
              <DropdownMenuItem
                key={a.label}
                disabled={a.disabled}
                onSelect={() => a.onClick()}
                className="text-destructive focus:text-destructive"
              >
                <a.icon className="size-4 me-2" /> {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
