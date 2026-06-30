import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/contexts/ShopContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Wallet, Eye, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { DetailsDialog } from "@/components/DetailsDialog";
import { useConfirm } from "@/components/ConfirmDialog";
import { Pagination } from "@/components/Pagination";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { format } from "date-fns";

const PAGE_SIZE_KEY = "pos.pageSize.expenses";
const DEFAULT_PAGE_SIZE = 20;

interface Category { id: string; name: string; color: string; }
interface Expense {
  id: string;
  amount: number;
  paid_to: string | null;
  description: string | null;
  expense_date: string;
  payment_method: string;
  category_id: string | null;
  category?: Category | null;
}

export default function Expenses() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currentShop } = useShop();
  const formatMoney = useFormatMoney();
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState<number>(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(PAGE_SIZE_KEY) : null;
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_PAGE_SIZE;
  });
  const setPageSize = (n: number) => {
    setPageSizeState(n);
    setPage(1);
    try { localStorage.setItem(PAGE_SIZE_KEY, String(n)); } catch {}
  };
  const [filterCat, setFilterCat] = useState<string>("all");
  const [from, setFrom] = useState(format(new Date(new Date().setDate(1)), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    amount: "", paid_to: "", description: "",
    expense_date: format(new Date(), "yyyy-MM-dd"),
    payment_method: "cash" as "cash" | "card" | "mobile" | "other",
    category_id: "",
  });
  const [details, setDetails] = useState<Expense | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const startEdit = (e: Expense) => {
    setEditingId(e.id);
    setForm({
      amount: String(e.amount),
      paid_to: e.paid_to ?? "",
      description: e.description ?? "",
      expense_date: e.expense_date,
      payment_method: (e.payment_method as any) ?? "cash",
      category_id: e.category_id ?? "",
    });
    setDetails(null);
    setOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      amount: "", paid_to: "", description: "",
      expense_date: format(new Date(), "yyyy-MM-dd"),
      payment_method: "cash",
      category_id: categories[0]?.id ?? "",
    });
  };

  const cur = currentShop?.currency ?? "USD";

  useEffect(() => { document.title = "UCU"; }, []);

  const loadCategories = useCallback(async () => {
    if (!currentShop) return;
    const { data } = await supabase
      .from("expense_categories")
      .select("id, name, color")
      .eq("shop_id", currentShop.id)
      .order("name");
    setCategories((data as any) ?? []);
    setForm((f) => ({ ...f, category_id: f.category_id || (data?.[0]?.id ?? "") }));
  }, [currentShop]);

  const load = useCallback(async () => {
    if (!currentShop) return;
    setLoading(true);
    const offset = (page - 1) * pageSize;
    let q = supabase
      .from("expenses")
      .select(
        "id, amount, paid_to, description, expense_date, payment_method, category_id",
        { count: "exact" },
      )
      .eq("shop_id", currentShop.id)
      .gte("expense_date", from)
      .lte("expense_date", to)
      .order("expense_date", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (filterCat !== "all") q = q.eq("category_id", filterCat);
    const { data, count } = await q;
    setExpenses(((data as any) ?? []) as Expense[]);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [currentShop, filterCat, from, to, page, pageSize]);

  // Reset to page 1 whenever filters change.
  useEffect(() => { setPage(1); }, [filterCat, from, to]);

  // Clamp page if totals shrink.
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [totalCount, pageSize, page]);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { load(); }, [load]);

  const total = useMemo(() => expenses.reduce((a, e) => a + Number(e.amount), 0), [expenses]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => {
      const key = e.category_id ?? "uncategorized";
      map.set(key, (map.get(key) ?? 0) + Number(e.amount));
    });
    return Array.from(map.entries()).map(([id, amt]) => ({
      id, amount: amt,
      name: categories.find((c) => c.id === id)?.name ?? t("expenses.uncategorized"),
      color: categories.find((c) => c.id === id)?.color ?? "#64748b",
    })).sort((a, b) => b.amount - a.amount);
  }, [expenses, categories, t]);

  const save = async () => {
    if (!user || !currentShop) return;
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return toast.error(t("expenses.invalidAmount"));
    setBusy(true);
    const payload = {
      amount: amt,
      paid_to: form.paid_to || null,
      description: form.description || null,
      expense_date: form.expense_date,
      payment_method: form.payment_method,
      category_id: form.category_id || null,
    };
    const { error } = editingId
      ? await supabase.from("expenses").update(payload).eq("id", editingId)
      : await supabase.from("expenses").insert({ ...payload, shop_id: currentShop.id, created_by: user.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editingId ? t("expenses.expenseUpdated") : t("expenses.expenseSaved"));
    setOpen(false);
    resetForm();
    load();
  };

  const remove = async (id: string) => {
    const ok = await confirm({
      title: t("expenses.title"),
      description: t("expenses.deleteConfirm"),
      variant: "destructive",
    });
    if (!ok) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("common.deleted"));
    load();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="size-6 text-primary" /> {t("expenses.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("expenses.subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}><Plus className="size-4 mr-2" /> {t("expenses.addNew")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? t("expenses.editExpense") : t("expenses.newExpense")}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
              <div className="space-y-1.5 col-span-1">
                <Label>{t("expenses.amount")}</Label>
                <Input type="number" step="0.01" value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5 col-span-1">
                <Label>{t("common.date")}</Label>
                <Input type="date" value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
              </div>
              <div className="space-y-1.5 col-span-1">
                <Label>{t("expenses.category")}</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder={t("expenses.pickCategory")} /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-1">
                <Label>{t("expenses.paymentMethod")}</Label>
                <Select value={form.payment_method} onValueChange={(v: any) => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t("pos.cash")}</SelectItem>
                    <SelectItem value="card">{t("pos.card")}</SelectItem>
                    <SelectItem value="mobile">{t("pos.mobile")}</SelectItem>
                    <SelectItem value="other">{t("pos.other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>{t("expenses.paidTo")}</Label>
                <Input value={form.paid_to} onChange={(e) => setForm({ ...form, paid_to: e.target.value })}
                  placeholder={t("expenses.paidToPlaceholder")} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>{t("common.description")}</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={save} disabled={busy}>{busy ? t("common.saving") : t("common.save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="space-y-1.5">
            <Label>{t("expenses.from")}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("expenses.to")}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("expenses.category")}</Label>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("expenses.allCategories")}</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("expenses.totalInRange")}</div>
          <div className="text-xl sm:text-3xl font-bold mt-1 tabular-nums break-words leading-tight">{formatMoney(total, cur)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{t("expenses.byCategory")}</div>
          {byCategory.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("common.empty")}</div>
          ) : (
            <div className="space-y-1.5">
              {byCategory.map((b) => (
                <div key={b.id} className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: b.color }} />
                    {b.name}
                  </span>
                  <span className="tabular-nums font-medium">{formatMoney(b.amount, cur)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.date")}</TableHead>
              <TableHead>{t("expenses.category")}</TableHead>
              <TableHead>{t("expenses.paidTo")}</TableHead>
              <TableHead>{t("common.description")}</TableHead>
              <TableHead className="text-end">{t("expenses.amount")}</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("common.loading")}</TableCell></TableRow>
            ) : expenses.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("expenses.empty")}</TableCell></TableRow>
            ) : (
              expenses.map((e) => {
                const cat = categories.find((c) => c.id === e.category_id);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="tabular-nums">{format(new Date(e.expense_date), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      {cat ? (
                        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full" style={{ background: `${cat.color}22`, color: cat.color }}>
                          <span className="size-1.5 rounded-full" style={{ background: cat.color }} />
                          {cat.name}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>{e.paid_to ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{e.description ?? "—"}</TableCell>
                    <TableCell className="text-end tabular-nums font-medium">{formatMoney(Number(e.amount), cur)}</TableCell>
                    <TableCell className="text-end whitespace-nowrap">
                      <Button variant="ghost" size="icon" title={t("common.details")} onClick={() => setDetails(e)}><Eye className="size-4" /></Button>
                      <Button variant="ghost" size="icon" title={t("common.edit")} onClick={() => startEdit(e)}><Edit2 className="size-4" /></Button>
                      <Button variant="ghost" size="icon" title={t("common.delete")} onClick={() => remove(e.id)}><Trash2 className="size-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalCount}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </Card>

      {details && (() => {
        const cat = categories.find((c) => c.id === details.category_id);
        return (
          <DetailsDialog
            open={!!details}
            onClose={() => setDetails(null)}
            title={formatMoney(Number(details.amount), cur)}
            subtitle={format(new Date(details.expense_date), "PPP")}
            rows={[
              { label: t("expenses.category"), value: cat?.name ?? t("expenses.uncategorized") },
              { label: t("expenses.paymentMethod"), value: <span className="capitalize">{details.payment_method}</span> },
              { label: t("expenses.paidTo"), value: details.paid_to ?? "—" },
              { label: t("common.date"), value: format(new Date(details.expense_date), "PPP") },
              { label: t("common.description"), value: details.description ?? "—", full: true },
            ]}
            footer={
              <Button variant="outline" onClick={() => startEdit(details)}>
                <Edit2 className="size-4 mr-1" /> {t("common.edit")}
              </Button>
            }
          />
        );
      })()}
      {confirmDialog}
    </div>
  );
}
