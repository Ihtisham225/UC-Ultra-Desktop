import { useMemo, useState } from "react";
import { CornerDownLeft } from "lucide-react";
import { CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { NavPage, NavSection } from "@/lib/app-nav";
import { pageFor, readRecentPages } from "@/lib/recent-pages";
import { appShortcutLabel } from "@/lib/shortcuts";
import { CommandPopup, Kbd, PopupCommand } from "./CommandPopup";

const SECTION_ORDER: NavSection[] = ["Overview", "Selling", "Stock", "Lab", "Workshop", "Money", "Store"];

interface Props {
  pages: NavPage[];
  pathname: string;
  onGo: (to: string) => void;
}

/**
 * Ctrl/Cmd+G — jump to any page the sidebar offers.
 *
 * Empty: the recently opened pages, then every page by section. Typing filters
 * one flat list (cmdk ranks word starts first, so "pu" finds Purchases).
 */
export function GoToDialog({
  open, onOpenChange, isMac, onCloseAutoFocus, ...list
}: Props & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMac: boolean;
  onCloseAutoFocus: (e: Event) => void;
}) {
  return (
    <CommandPopup
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      title="Go to a page"
      description="Type a page name and press Enter to open it."
      footer={
        <>
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd><Kbd>↓</Kbd> move <Kbd><CornerDownLeft className="size-3" /></Kbd> open <Kbd>Esc</Kbd> close
          </span>
          <span className="flex items-center gap-1.5">Go to <Kbd>{appShortcutLabel("goTo", isMac)}</Kbd></span>
        </>
      }
    >
      <GoToList {...list} />
    </CommandPopup>
  );
}

/** Mounted only while the popup is open, so the search and recents start fresh. */
function GoToList({ pages, pathname, onGo }: Props) {
  const [search, setSearch] = useState("");
  // Safe in an initializer: this never renders on the server — it only exists
  // once someone has opened the popup.
  const [recent] = useState(readRecentPages);

  const current = pageFor(pathname, pages.map((p) => p.to));
  const byTo = useMemo(() => new Map(pages.map((p) => [p.to, p])), [pages]);
  const recentPages = recent
    .filter((to) => to !== current)
    .map((to) => byTo.get(to))
    .filter((p): p is NavPage => !!p)
    .slice(0, 4);

  const typing = search.trim().length > 0;

  const item = (p: NavPage, prefix: string) => (
    <CommandItem
      key={`${prefix}${p.to}`}
      value={`${prefix}${p.label} ${p.to}`}
      keywords={[p.section, ...(p.keywords ?? [])]}
      onSelect={() => onGo(p.to)}
      className="gap-3 px-3 py-2.5 mx-1 rounded-md"
    >
      <span className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0">
        <p.icon className="size-4 text-muted-foreground" />
      </span>
      <span className="flex-1 min-w-0 truncate font-medium">{p.label}</span>
      {p.to === current ? (
        <span className="text-[11px] text-primary font-medium">You&rsquo;re here</span>
      ) : (
        <span className="text-[11px] text-muted-foreground">{p.section}</span>
      )}
    </CommandItem>
  );

  return (
    <PopupCommand>
      <CommandInput value={search} onValueChange={setSearch} placeholder="Go to page…" />
      <CommandList className="max-h-[min(60vh,440px)] pb-2">
        <CommandEmpty>No page called “{search}”.</CommandEmpty>
        {!typing && recentPages.length > 0 && (
          <CommandGroup heading="Recent">{recentPages.map((p) => item(p, "recent:"))}</CommandGroup>
        )}
        {typing ? (
          <CommandGroup heading="Pages">{pages.map((p) => item(p, ""))}</CommandGroup>
        ) : (
          SECTION_ORDER.map((section) => {
            const inSection = pages.filter((p) => p.section === section);
            if (!inSection.length) return null;
            return <CommandGroup key={section} heading={section}>{inSection.map((p) => item(p, ""))}</CommandGroup>;
          })
        )}
      </CommandList>
    </PopupCommand>
  );
}
