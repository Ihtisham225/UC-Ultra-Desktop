import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { rpc } from "@/lib/apiClient";
import type {
  AuditLogRow, AuditPage, AuditQuery, AuditVocabulary,
} from "@/lib/adminTypes";
import { AdminPageHeader, Section, Empty, SeverityDot, Pill, ago } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Download, Search, RotateCcw, Laptop, Globe, Server, KeyRound, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 50;
const ANY = "__any__";

/** One row's origin, as an icon — a till and a browser read very differently. */
function SourceIcon({ source }: { source: string }) {
  const Icon = source === "desktop" ? Laptop : source === "system" ? Server : source === "api" ? KeyRound : Globe;
  return <Icon className="size-3.5 text-muted-foreground" aria-label={source} />;
}

/**
 * The platform trail, on the terminal. Server-side over RPC with no offline
 * store behind it — the log lives on the server by definition, and a terminal
 * that could answer from its own cache would be answering about itself.
 */
export default function AdminAudit() {
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [vocab, setVocab] = useState<AuditVocabulary | null>(null);
  const [actors, setActors] = useState<{ id: string; name: string }[]>([]);
  const [detail, setDetail] = useState<AuditLogRow | null>(null);

  // Filters. `search` is applied on submit rather than per keystroke — this
  // query hits a table that grows forever, and one request per letter typed
  // is how a log screen becomes the slowest page in the app.
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | "platform" | "shop">("all");
  const [shopId, setShopId] = useState<string>(ANY);
  const [group, setGroup] = useState<string>(ANY);
  const [severity, setSeverity] = useState<string>(ANY);
  const [source, setSource] = useState<string>(ANY);
  const [actor, setActor] = useState<string>(ANY);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const query = useMemo<AuditQuery>(() => ({
    scope,
    shop_id: shopId === ANY ? null : shopId,
    group: group === ANY ? undefined : group,
    severity: severity === ANY ? undefined : [severity as "info"],
    source: source === ANY ? undefined : [source as "web"],
    actor_user_id: actor === ANY ? undefined : actor,
    search: search || undefined,
    // ⚠️ A half-typed year ("2026-0") must never reach the server as a date —
    // `new Date("")` is Invalid and the range would silently swallow the whole
    // table. Only a complete yyyy-mm-dd is sent; the action parses it.
    from: /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined,
    to: /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : undefined,
    page,
    page_size: PAGE_SIZE,
  }), [scope, shopId, group, severity, source, actor, search, from, to, page]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await rpc<AuditPage>("adminListAuditAction", query);
      setRows(res.rows);
      setTotal(res.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load the log");
    }
    setLoading(false);
  }, [query]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    rpc<AuditVocabulary>("auditVocabularyAction").then(setVocab).catch(() => {});
    rpc<{ id: string; name: string }[]>("adminAuditActorsAction").then(setActors).catch(() => {});
    // The store filter needs every store, not just the ones this admin is in.
    rpc<{ shop_id: string; name: string }[]>("adminListShopsAction")
      .then((rows) => setShops(rows.map((r) => ({ id: r.shop_id, name: r.name }))))
      .catch(() => {});
  }, []);

  // Any filter change puts you back on page one — staying on page 9 of a
  // result set that now has two pages shows an empty screen.
  const onFilter = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  const reset = () => {
    setSearchDraft(""); setSearch(""); setScope("all"); setShopId(ANY);
    setGroup(ANY); setSeverity(ANY); setSource(ANY); setActor(ANY);
    setFrom(""); setTo(""); setPage(1);
  };

  const exportCsv = async () => {
    try {
      const res = await rpc<{ csv: string; rows: number; capped: boolean }>(
        // ⚠️ rpc() is variadic: one object argument, never wrapped in an array.
        "adminExportAuditAction", { ...query, page: 1 },
      );
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        res.capped
          ? `Exported the most recent ${res.rows.toLocaleString()} lines — narrow the filters for the rest.`
          : `Exported ${res.rows.toLocaleString()} lines`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <AdminPageHeader
        title="Audit log"
        description="Who did what, to what, and from where. Platform actions and shop activity in one trail."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="size-4 me-1.5" /> Reset
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={total === 0}>
              <Download className="size-4 me-1.5" /> Export CSV
            </Button>
          </>
        }
      />

      <div className="rounded-lg border bg-card p-3 mb-4 space-y-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => { e.preventDefault(); setSearch(searchDraft); setPage(1); }}
        >
          <div className="relative flex-1">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search what happened, who did it, or which record…"
              className="ps-8"
            />
          </div>
          <Button type="submit" size="sm">Search</Button>
        </form>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <div>
            <Label className="text-xs text-muted-foreground">Scope</Label>
            <Select value={scope} onValueChange={onFilter((v: string) => setScope(v as "all"))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everything</SelectItem>
                <SelectItem value="platform">Platform only</SelectItem>
                <SelectItem value="shop">Shop activity</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Store</Label>
            <Select value={shopId} onValueChange={onFilter(setShopId)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any store</SelectItem>
                {shops.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Area</Label>
            <Select value={group} onValueChange={onFilter(setGroup)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any area</SelectItem>
                {vocab?.groups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Severity</Label>
            <Select value={severity} onValueChange={onFilter(setSeverity)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="notice">Notice</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Select value={source} onValueChange={onFilter(setSource)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Anywhere</SelectItem>
                <SelectItem value="web">Web</SelectItem>
                <SelectItem value="desktop">Terminal</SelectItem>
                <SelectItem value="system">Server</SelectItem>
                <SelectItem value="api">API</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Who</Label>
            <Select value={actor} onValueChange={onFilter(setActor)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Anyone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Anyone</SelectItem>
                {actors.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Since</Label>
              <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-9" />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Until</Label>
              <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-9" />
            </div>
          </div>
        </div>
      </div>

      <Section
        title={`${total.toLocaleString()} line${total === 1 ? "" : "s"}`}
        description={loading ? "Loading…" : undefined}
        actions={
          pages > 1 ? (
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
          ) : undefined
        }
      >
        {rows.length === 0 && !loading ? (
          <Empty label="Nothing matches these filters." />
        ) : (
          <div className="overflow-x-auto -m-4">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-start ps-4 p-2.5 font-medium">When</th>
                  <th className="text-start p-2.5 font-medium">Who</th>
                  <th className="text-start p-2.5 font-medium">Store</th>
                  <th className="text-start p-2.5 font-medium">What happened</th>
                  <th className="text-start pe-4 p-2.5 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => setDetail(r)}
                  >
                    <td className="ps-4 p-2.5 whitespace-nowrap text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <SeverityDot severity={r.severity} />
                        <span title={new Date(r.created_at).toLocaleString()}>{ago(r.created_at)}</span>
                      </div>
                    </td>
                    <td className="p-2.5 whitespace-nowrap">
                      <div className="font-medium truncate max-w-[12rem]">{r.actor_name ?? r.actor_email ?? "System"}</div>
                      {r.actor_role && <div className="text-xs text-muted-foreground">{r.actor_role.replace("_", " ")}</div>}
                    </td>
                    <td className="p-2.5 whitespace-nowrap text-muted-foreground truncate max-w-[10rem]">
                      {r.shop_name ?? "—"}
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-start gap-2">
                        <SourceIcon source={r.source} />
                        <span>{r.summary}</span>
                      </div>
                    </td>
                    <td className="pe-4 p-2.5 whitespace-nowrap">
                      <Pill tone={r.scope === "platform" ? "primary" : "muted"}>{r.action_group}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detail && <SeverityDot severity={detail.severity} />}
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
                <dd className="col-span-2">
                  {detail.actor_name ?? "System"}
                  {detail.actor_email ? ` · ${detail.actor_email}` : ""}
                  {detail.actor_role ? ` · ${detail.actor_role.replace("_", " ")}` : ""}
                </dd>
                <dt className="text-muted-foreground">Store</dt>
                <dd className="col-span-2">{detail.shop_name ?? "—"}</dd>
                <dt className="text-muted-foreground">Record</dt>
                <dd className="col-span-2">
                  {detail.entity_label ?? detail.entity_type ?? "—"}
                  {detail.entity_id && (
                    <span className="block font-mono text-[10px] text-muted-foreground break-all">{detail.entity_id}</span>
                  )}
                </dd>
                <dt className="text-muted-foreground">Source</dt>
                <dd className="col-span-2 capitalize">{detail.source}</dd>
                <dt className="text-muted-foreground">IP</dt>
                <dd className="col-span-2 font-mono text-[11px]">{detail.ip_address ?? "—"}</dd>
                <dt className="text-muted-foreground">Action</dt>
                <dd className="col-span-2 font-mono text-[11px]">{detail.action}</dd>
              </dl>
              {detail.metadata != null && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Details</div>
                  <pre className="rounded-md bg-muted p-2.5 text-[11px] overflow-x-auto max-h-56">
                    {JSON.stringify(detail.metadata, null, 2)}
                  </pre>
                </div>
              )}
              {detail.user_agent && (
                <div className="text-[10px] text-muted-foreground break-all">{detail.user_agent}</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
