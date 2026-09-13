import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { rpc } from "@/lib/apiClient";
import type { AuditLogRow, AuditPage, AuditVocabulary } from "@/lib/adminTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ScrollText, Search, RotateCcw, Laptop, Globe, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;
const ANY = "__any__";

function Dot({ severity }: { severity: string }) {
  return (
    <span
      className={cn(
        "inline-block size-2 rounded-full shrink-0",
        severity === "critical" && "bg-destructive",
        severity === "warning" && "bg-amber-500",
        severity === "notice" && "bg-sky-500",
        severity === "info" && "bg-muted-foreground/40",
      )}
    />
  );
}

/**
 * What has happened in this store, and who did it.
 *
 * ⚠️ The shop id is NEVER sent from here — the action takes it from the
 * session, so no amount of fiddling with a request reaches another store's
 * trail.
 */
/**
 * The store's own trail, on the terminal.
 *
 * ⚠️ Server-side over RPC with no offline store behind it, unlike the till
 * screens. The trail lives on the server by definition — a terminal answering
 * from its own cache would only be able to describe its own actions, which is
 * the opposite of what this screen is for. Offline it says so.
 */
export default function Activity() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [vocab, setVocab] = useState<AuditVocabulary | null>(null);
  const [actors, setActors] = useState<{ id: string; name: string }[]>([]);
  const [detail, setDetail] = useState<AuditLogRow | null>(null);

  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState(ANY);
  const [actor, setActor] = useState(ANY);
  const [severity, setSeverity] = useState(ANY);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const query = useMemo(() => ({
    group: group === ANY ? undefined : group,
    actor_user_id: actor === ANY ? undefined : actor,
    severity: severity === ANY ? undefined : [severity as "info"],
    search: search || undefined,
    // Only a complete date is sent — an <input type="date"> reports every
    // half-typed year as you go, and "2026-0" is not a date.
    from: /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined,
    to: /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : undefined,
    page,
    page_size: PAGE_SIZE,
  }), [group, actor, severity, search, from, to, page]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await rpc<AuditPage>("listShopActivityAction", query);
      setRows(res.rows);
      setTotal(res.total);
    } catch (e) {
      toast.error(
        navigator.onLine
          ? (e instanceof Error ? e.message : "Couldn't load the activity log")
          : "The activity log is kept on the server — reconnect to read it.",
      );
    }
    setLoading(false);
  }, [query]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    rpc<AuditVocabulary>("auditVocabularyAction").then(setVocab).catch(() => {});
    rpc<{ id: string; name: string }[]>("listShopActivityActorsAction").then(setActors).catch(() => {});
  }, []);

  const reset = () => {
    setSearchDraft(""); setSearch(""); setGroup(ANY); setActor(ANY);
    setSeverity(ANY); setFrom(""); setTo(""); setPage(1);
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="size-6 text-primary" /> Activity
          </h1>
          <p className="text-sm text-muted-foreground">
            Everything that has happened in this store — who did it, and when.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw className="size-4 me-1.5" /> Reset filters
        </Button>
      </div>

      <Card>
        <CardContent className="p-3 space-y-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); setSearch(searchDraft); setPage(1); }}
          >
            <div className="relative flex-1">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Search — a bill number, a product, a name…"
                className="ps-8"
              />
            </div>
            <Button type="submit" size="sm">Search</Button>
          </form>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs text-muted-foreground">Area</Label>
              <Select value={group} onValueChange={(v) => { setGroup(v); setPage(1); }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Everything</SelectItem>
                  {/* Platform lines never reach this screen, so the platform
                      group would always come back empty. */}
                  {vocab?.groups.filter((g) => g !== "Platform").map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Who</Label>
              <Select value={actor} onValueChange={(v) => { setActor(v); setPage(1); }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Anyone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Anyone</SelectItem>
                  {actors.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Importance</Label>
              <Select value={severity} onValueChange={(v) => { setSeverity(v); setPage(1); }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Anything</SelectItem>
                  <SelectItem value="critical">Deletions only</SelectItem>
                  <SelectItem value="warning">Changes</SelectItem>
                  <SelectItem value="notice">Notable</SelectItem>
                  <SelectItem value="info">Routine</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-9" />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-9" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="text-sm font-medium">
            {loading ? "Loading…" : `${total.toLocaleString()} entr${total === 1 ? "y" : "ies"}`}
          </span>
          {pages > 1 && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="size-8" disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums px-1">{page} / {pages}</span>
              <Button variant="outline" size="icon" className="size-8" disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
        <CardContent className="p-0">
          {rows.length === 0 && !loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nothing matches these filters.
            </div>
          ) : (
            <ul className="divide-y">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer"
                  onClick={() => setDetail(r)}
                >
                  <span className="mt-1.5"><Dot severity={r.severity} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{r.summary}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      <span className="font-medium text-foreground/70">
                        {r.actor_name ?? r.actor_email ?? "System"}
                      </span>
                      <span>·</span>
                      <span>{new Date(r.created_at).toLocaleString()}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        {r.source === "desktop"
                          ? <><Laptop className="size-3" /> Terminal</>
                          : <><Globe className="size-3" /> Web</>}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detail && <Dot severity={detail.severity} />}
              {detail?.action_label}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <p>{detail.summary}</p>
              <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-xs">
                <dt className="text-muted-foreground">When</dt>
                <dd className="col-span-2">{new Date(detail.created_at).toLocaleString()}</dd>
                <dt className="text-muted-foreground">Who</dt>
                <dd className="col-span-2">{detail.actor_name ?? detail.actor_email ?? "System"}</dd>
                <dt className="text-muted-foreground">Record</dt>
                <dd className="col-span-2">{detail.entity_label ?? detail.entity_type ?? "—"}</dd>
                <dt className="text-muted-foreground">From</dt>
                <dd className="col-span-2">{detail.source === "desktop" ? "The terminal" : "The web app"}</dd>
              </dl>
              {detail.metadata != null && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Details</div>
                  <pre className="rounded-md bg-muted p-2.5 text-[11px] overflow-x-auto max-h-56">
                    {JSON.stringify(detail.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
