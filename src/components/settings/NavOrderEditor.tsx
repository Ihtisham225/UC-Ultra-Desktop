/**
 * Settings → Shop → Menu: the owner arranges the sidebar — which group comes
 * first, and the order of the pages inside each one. Drag a row, or use the
 * arrows (keyboard-friendly). Saved for the whole shop (lib/nav-order).
 *
 * ⚠️ COPIED verbatim to the desktop (minus "use client"); each host passes
 * its own `onSave`.
 */

import { useState, type DragEvent } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, GripVertical, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NAV_SECTION_LABEL, type NavSection } from "@/lib/app-nav";
import { moveItem, navOrderFrom, type NavGroup, type NavOrder } from "@/lib/nav-order";

type Drag = { kind: "section"; index: number } | { kind: "page"; section: NavSection; index: number };

export function NavOrderEditor({
  groups: initial,
  customised,
  disabled,
  onSave,
}: {
  /** The sidebar as it stands, in the shop's current order. */
  groups: NavGroup[];
  /** Whether the shop has an order of its own (enables Reset). */
  customised: boolean;
  disabled?: boolean;
  onSave: (order: NavOrder | null) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [groups, setGroups] = useState<NavGroup[]>(initial);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(navOrderFrom(groups)) !== JSON.stringify(navOrderFrom(initial));

  const moveSection = (from: number, to: number) => setGroups((g) => moveItem(g, from, to));
  const movePage = (section: NavSection, from: number, to: number) =>
    setGroups((g) => g.map((x) => (x.section === section ? { ...x, items: moveItem(x.items, from, to) } : x)));

  const save = async (order: NavOrder | null) => {
    setBusy(true);
    const res = await onSave(order).catch((e) => ({ ok: false, error: e instanceof Error ? e.message : "Could not save" }));
    setBusy(false);
    if (!res.ok) toast.error(res.error ?? "Could not save the menu");
  };

  // Native drag-and-drop: a page only moves within its own group, a group among groups.
  const dragProps = (d: Drag, key: string) => ({
    draggable: !disabled,
    onDragStart: (e: DragEvent) => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; setDrag(d); },
    onDragEnd: () => { setDrag(null); setOver(null); },
    onDragOver: (e: DragEvent) => {
      if (!drag || drag.kind !== d.kind || (d.kind === "page" && drag.kind === "page" && drag.section !== d.section)) return;
      e.preventDefault();
      e.stopPropagation();
      setOver(key);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (drag?.kind === "section" && d.kind === "section") moveSection(drag.index, d.index);
      if (drag?.kind === "page" && d.kind === "page" && drag.section === d.section) movePage(d.section, drag.index, d.index);
      setDrag(null);
      setOver(null);
    },
  });

  const arrows = (index: number, count: number, move: (from: number, to: number) => void, what: string) => (
    <div className="flex shrink-0 gap-0.5">
      <Button type="button" size="icon" variant="ghost" className="size-7" disabled={disabled || index === 0} onClick={() => move(index, index - 1)} aria-label={`Move ${what} up`}>
        <ArrowUp className="size-3.5" />
      </Button>
      <Button type="button" size="icon" variant="ghost" className="size-7" disabled={disabled || index === count - 1} onClick={() => move(index, index + 1)} aria-label={`Move ${what} down`}>
        <ArrowDown className="size-3.5" />
      </Button>
    </div>
  );

  return (
    <Card className="shadow-card p-6 space-y-4">
      <div>
        <h3 className="font-semibold">Sidebar menu</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Drag the groups and the pages inside them (or use the arrows) into the order your team uses most. It changes
          the menu for everyone in this shop; each person still only sees the pages they&apos;re allowed to open.
        </p>
      </div>

      <div className="space-y-3">
        {groups.map((g, gi) => (
          <div
            key={g.section}
            {...dragProps({ kind: "section", index: gi }, `s:${g.section}`)}
            className={`rounded-lg border bg-muted/20 ${over === `s:${g.section}` ? "ring-2 ring-primary/50" : ""} ${drag?.kind === "section" && drag.index === gi ? "opacity-50" : ""}`}
          >
            <div className="flex items-center gap-2 px-2 py-1.5 border-b bg-muted/40 rounded-t-lg">
              <GripVertical className={`size-4 text-muted-foreground ${disabled ? "" : "cursor-grab"}`} />
              <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{NAV_SECTION_LABEL[g.section]}</span>
              {arrows(gi, groups.length, moveSection, `the ${NAV_SECTION_LABEL[g.section]} group`)}
            </div>
            <ul className="p-1">
              {g.items.map((p, pi) => {
                const Icon = p.icon;
                const key = `p:${p.to}`;
                return (
                  <li
                    key={p.to}
                    {...dragProps({ kind: "page", section: g.section, index: pi }, key)}
                    className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-background ${over === key ? "ring-2 ring-primary/50 bg-background" : ""} ${drag?.kind === "page" && drag.section === g.section && drag.index === pi ? "opacity-50" : ""}`}
                  >
                    <GripVertical className={`size-3.5 text-muted-foreground/70 ${disabled ? "" : "cursor-grab"}`} />
                    <Icon className="size-4 text-primary shrink-0" />
                    <span className="flex-1 truncate">{p.label}</span>
                    {arrows(pi, g.items.length, (from, to) => movePage(g.section, from, to), p.label)}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {!disabled && (
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={busy || !dirty} onClick={() => void save(navOrderFrom(groups))} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
            Save menu order
          </Button>
          {dirty && (
            <Button variant="ghost" disabled={busy} onClick={() => setGroups(initial)}>Undo changes</Button>
          )}
          {customised && (
            <Button variant="outline" disabled={busy} onClick={() => void save(null)}>
              <RotateCcw className="size-3.5 me-1.5" /> Reset to default
            </Button>
          )}
        </div>
      )}
      {disabled && <p className="text-xs text-muted-foreground">Only the shop owner can change the menu order.</p>}
    </Card>
  );
}
