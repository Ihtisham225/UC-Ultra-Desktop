import { useEffect, useState } from "react";
import { toast } from "sonner";
import { rpc } from "@/lib/apiClient";
import type { AnnouncementDto, AnnouncementInput, RpcResult } from "@/lib/adminTypes";
import { AdminPageHeader, Section, Empty, Pill, SeverityDot, ago } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Megaphone, Pencil, Trash2, Eye, Sparkles } from "lucide-react";
import { AnnouncementMedia, youtubeId } from "@/components/announcements/AnnouncementMedia";

const STORE_TYPES = [
  "phone", "computer", "pharmacy", "supermarket", "industry", "wholesale",
  "accessories", "handicraft", "oil", "other",
];

const EMPTY: AnnouncementInput = {
  title: "",
  body: "",
  severity: "info",
  audience: "all",
  store_type: null,
  dismissible: true,
  is_active: true,
  starts_at: null,
  ends_at: null,
  target_shop_ids: [],
  style: "banner",
  media_type: null,
  media_url: null,
  cta_label: null,
  cta_url: null,
};

/** An <input type="datetime-local"> wants "yyyy-MM-ddTHH:mm" in LOCAL time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminAnnouncements() {
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = useState<AnnouncementDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id: string | null; draft: AnnouncementInput } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementDto | null>(null);

  const load = async () => {
    setLoading(true);
    try { setRows(await rpc<AnnouncementDto[]>("adminListAnnouncementsAction")); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't load notices"); }
    setLoading(false);
  };
  useEffect(() => {
    load();
    rpc<{ shop_id: string; name: string }[]>("adminListShopsAction")
      .then((r) => setShops(r.map((x) => ({ id: x.shop_id, name: x.name }))))
      .catch(() => {});
  }, []);

  const openNew = () => setEditing({ id: null, draft: { ...EMPTY } });
  const openEdit = (a: AnnouncementDto) => setEditing({
    id: a.id,
    draft: {
      title: a.title,
      body: a.body,
      severity: a.severity,
      audience: a.audience,
      store_type: a.store_type,
      dismissible: a.dismissible,
      is_active: a.is_active,
      starts_at: a.starts_at,
      ends_at: a.ends_at,
      target_shop_ids: a.target_shop_ids,
      style: a.style,
      media_type: a.media_type,
      media_url: a.media_url,
      cta_label: a.cta_label,
      cta_url: a.cta_url,
    },
  });

  const patch = (p: Partial<AnnouncementInput>) =>
    setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...p } } : e));

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      // ⚠️ Variadic: two separate arguments, never one array.
      const res = await rpc<RpcResult>("adminSaveAnnouncementAction", editing.id, editing.draft);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(editing.id ? "Notice updated" : "Notice posted");
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the notice");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const res = await rpc<RpcResult>("adminDeleteAnnouncementAction", deleteTarget.id);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Notice deleted");
    setDeleteTarget(null);
    load();
  };

  const reachOf = (a: AnnouncementDto) =>
    a.audience === "all" ? "Every store"
      : a.audience === "store_type" ? `Every ${a.store_type} store`
        : `${a.target_shop_ids.length} store${a.target_shop_ids.length === 1 ? "" : "s"}`;

  const d = editing?.draft;

  return (
    <>
      <AdminPageHeader
        title="Announcements"
        description="Notices shown inside shops — maintenance, new features, payment reminders."
        actions={<Button size="sm" onClick={openNew}><Plus className="size-4 me-1.5" /> New notice</Button>}
      />

      <Section title={`${rows.length} notice${rows.length === 1 ? "" : "s"}`}>
        {rows.length === 0 ? (
          <Empty label={loading ? "Loading…" : "Nothing has been posted yet."} />
        ) : (
          <ul className="divide-y -my-2">
            {rows.map((a) => (
              <li key={a.id} className="py-3 flex items-start gap-3">
                <span className="mt-1.5"><SeverityDot severity={a.severity} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.title}</span>
                    {a.live ? <Pill tone="success">Live</Pill> : <Pill>Off</Pill>}
                    <Pill tone="muted">{reachOf(a)}</Pill>
                    {!a.dismissible && <Pill tone="warning">Can&apos;t dismiss</Pill>}
                    {a.style === "popup" && <Pill tone="muted">Pop-up</Pill>}
                    {a.media_type && <Pill tone="muted">{a.media_type === "image" ? "Picture" : "Video"}</Pill>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{a.body}</p>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                    <span>Posted {ago(a.created_at)}</span>
                    <span className="flex items-center gap-1">
                      <Eye className="size-3" /> {a.read_count} dismissed
                    </span>
                    {a.ends_at && <span>Ends {new Date(a.ends_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(a)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="size-8 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(a)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="size-4" />
              {editing?.id ? "Edit notice" : "New notice"}
            </DialogTitle>
          </DialogHeader>
          {d && (
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input value={d.title} onChange={(e) => patch({ title: e.target.value })}
                  placeholder="Scheduled maintenance on Sunday" />
              </div>
              <div>
                <Label>Notice</Label>
                <Textarea rows={4} value={d.body} onChange={(e) => patch({ body: e.target.value })}
                  placeholder="What the shopkeeper needs to know, in plain words." />
              </div>

              <MediaFields draft={d} patch={patch} />

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Importance</Label>
                  <Select value={d.severity} onValueChange={(v) => patch({ severity: v as "info" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info — grey</SelectItem>
                      <SelectItem value="notice">Notice — blue</SelectItem>
                      <SelectItem value="warning">Warning — amber</SelectItem>
                      <SelectItem value="critical">Critical — red</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Who sees it</Label>
                  <Select value={d.audience} onValueChange={(v) => patch({ audience: v as "all" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Every store</SelectItem>
                      <SelectItem value="store_type">One kind of store</SelectItem>
                      <SelectItem value="shops">Stores I pick</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {d.audience === "store_type" && (
                <div>
                  <Label>Kind of store</Label>
                  <Select value={d.store_type ?? ""} onValueChange={(v) => patch({ store_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger>
                    <SelectContent>
                      {STORE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {d.audience === "shops" && (
                <div>
                  <Label>Stores ({d.target_shop_ids.length} picked)</Label>
                  <ScrollArea className="h-40 rounded-md border p-2 mt-1">
                    {shops.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                        <Checkbox
                          checked={d.target_shop_ids.includes(s.id)}
                          onCheckedChange={(on) =>
                            patch({
                              target_shop_ids: on
                                ? [...d.target_shop_ids, s.id]
                                : d.target_shop_ids.filter((x) => x !== s.id),
                            })
                          }
                        />
                        {s.name}
                      </label>
                    ))}
                  </ScrollArea>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Show from</Label>
                  <Input
                    type="datetime-local"
                    value={toLocalInput(d.starts_at ?? null)}
                    onChange={(e) => patch({ starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  />
                </div>
                <div>
                  <Label>Stop showing</Label>
                  <Input
                    type="datetime-local"
                    value={toLocalInput(d.ends_at ?? null)}
                    onChange={(e) => patch({ ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="font-medium">Active</span>
                    <span className="block text-xs text-muted-foreground">
                      Off hides it everywhere without losing who has read it.
                    </span>
                  </span>
                  <Switch checked={d.is_active} onCheckedChange={(v) => patch({ is_active: v })} />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="font-medium">Can be dismissed</span>
                    <span className="block text-xs text-muted-foreground">
                      Turn off for something everyone must see, like a maintenance window.
                    </span>
                  </span>
                  <Switch checked={d.dismissible} onCheckedChange={(v) => patch({ dismissible: v })} />
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing?.id ? "Save changes" : "Post notice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this notice?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.title}&rdquo; will be removed for everyone, along with the record
              of who had read it. To simply stop showing it, switch it off instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); remove(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


/**
 * How the notice shows, its picture or video (a pasted link — uploading a
 * file is done from the web admin, since the upload is signed for a browser
 * session), and an optional button. Same fields as the web form, so editing a
 * notice here never drops what was set there.
 */
function MediaFields({ draft: d, patch }: { draft: AnnouncementInput; patch: (p: Partial<AnnouncementInput>) => void }) {
  const linkType = (url: string) => (youtubeId(url) ? "youtube" : /\.(mp4|webm|mov)(\?|$)/i.test(url) ? "video" : "image");
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div>
        <Label>How it shows</Label>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {([
            ["banner", Megaphone, "Banner", "A strip across the top of the app"],
            ["popup", Sparkles, "Pop-up", "A card that opens once, picture or video large — for new features"],
          ] as const).map(([value, Icon, label, hint]) => (
            <button
              key={value}
              type="button"
              onClick={() => patch({ style: value })}
              className={`flex items-start gap-2 rounded-lg border p-2.5 text-start text-sm ${(d.style ?? "banner") === value ? "border-primary ring-2 ring-primary/30" : "hover:bg-muted/50"}`}
            >
              <Icon className="size-4 mt-0.5 text-primary" />
              <span>
                <span className="block font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Picture or video link (optional)</Label>
        <Input
          placeholder="An image, an .mp4, or a YouTube video — upload files from the web admin"
          value={d.media_url ?? ""}
          onChange={(e) => {
            const url = e.target.value.trim();
            patch({ media_url: url || null, media_type: url ? linkType(url) : null });
          }}
        />
        {d.media_url && (
          <div className="max-w-sm">
            <AnnouncementMedia type={d.media_type ?? null} url={d.media_url} />
          </div>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
        <div>
          <Label>Button text (optional)</Label>
          <Input placeholder="Try it" value={d.cta_label ?? ""} onChange={(e) => patch({ cta_label: e.target.value || null })} maxLength={40} />
        </div>
        <div>
          <Label>Button opens</Label>
          <Input placeholder="/payroll — or https://…" value={d.cta_url ?? ""} onChange={(e) => patch({ cta_url: e.target.value || null })} />
        </div>
      </div>
    </div>
  );
}
