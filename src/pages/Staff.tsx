import { useCallback, useEffect, useState } from "react";
import { rpc } from "@/lib/apiClient";
import { useShop } from "@/contexts/ShopContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Trash2, KeyRound, ShieldCheck, Plus, Copy, Ban, CheckCircle2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { MODULES, ACTIONS, MODULE_LABEL, ACTION_LABEL, ACTION_HINT, type Module, type Action } from "@/lib/permissions";

type Member = { user_id: string; role: "owner" | "manager" | "cashier"; disabled: boolean; display_name: string | null };
type Role = { id: string; name: string; is_system: boolean };
type RP = { role_id: string; module: Module; action: Action };
type URA = { user_id: string; role_id: string };

export default function Staff() {
  const { user } = useAuth();
  const { currentShop, role: myRole } = useShop();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolePerms, setRolePerms] = useState<RP[]>([]);
  const [assignments, setAssignments] = useState<URA[]>([]);
  const [loading, setLoading] = useState(true);

  const [openCreate, setOpenCreate] = useState(false);
  const [newStaff, setNewStaff] = useState({ full_name: "", role_id: "" });
  const [creating, setCreating] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ username: string; password: string } | null>(null);

  const [openRole, setOpenRole] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleMatrix, setRoleMatrix] = useState<Set<string>>(new Set());
  const [resetCreds, setResetCreds] = useState<{ email: string; password: string } | null>(null);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [editStaff, setEditStaff] = useState<{ user_id: string; full_name: string; username: string } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const isAdmin = myRole === "owner" || myRole === "manager";

  useEffect(() => { document.title = "Staff & Roles — UCU"; }, []);

  const load = useCallback(async () => {
    if (!currentShop) return;
    setLoading(true);
    try {
      const data = await rpc<{
        members: Member[];
        roles: Role[];
        rolePerms: RP[];
        assignments: URA[];
        usernames: Record<string, string>;
      }>("loadStaffDataAction");
      setMembers(data.members ?? []);
      setRoles(data.roles ?? []);
      setRolePerms(data.rolePerms ?? []);
      setAssignments(data.assignments ?? []);
      setUsernames(data.usernames ?? {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [currentShop]);

  useEffect(() => { load(); }, [load]);

  const createStaff = async () => {
    if (!currentShop) return;
    if (!newStaff.full_name.trim() || !newStaff.role_id) return toast.error("Name & role are required");
    setCreating(true);
    try {
      const res = await rpc<{ ok: boolean; username?: string; temp_password?: string; error?: string }>("createStaffAction", {
        full_name: newStaff.full_name.trim(),
        role_id: newStaff.role_id,
      });
      if (!res.ok || !res.username || !res.temp_password) return toast.error(res.error ?? "Failed");
      setCreatedCreds({ username: res.username, password: res.temp_password });
      setNewStaff({ full_name: "", role_id: "" });
      setOpenCreate(false);
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreating(false);
    }
    load();
  };

  const removeStaff = async (m: Member) => {
    if (!currentShop) return;
    if (m.role === "owner") return toast.error("Cannot remove owner");
    if (!(await confirm({ title: "Remove staff?", description: `${m.display_name ?? "This member"} will lose access.`, variant: "destructive" }))) return;
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("deleteStaffAction", m.user_id);
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    }
    toast.success("Removed"); load();
  };

  const toggleBlocked = async (m: Member) => {
    if (!currentShop) return;
    if (m.role === "owner") return toast.error("Cannot block owner");
    const next = !m.disabled;
    if (!(await confirm({
      title: next ? "Block staff?" : "Unblock staff?",
      description: next ? "They will be signed out and unable to log in." : "They will be able to log in again.",
    }))) return;
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("setStaffDisabledAction", m.user_id, next);
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    }
    toast.success(next ? "Blocked" : "Unblocked"); load();
  };

  const resetPwd = async (m: Member) => {
    if (!currentShop) return;
    if (!(await confirm({ title: "Reset password?", description: "A new temporary password will be generated." }))) return;
    try {
      const res = await rpc<{ ok: boolean; temp_password?: string; error?: string }>("resetStaffPasswordAction", m.user_id);
      if (!res.ok || !res.temp_password) return toast.error(res.error ?? "Failed");
      setResetCreds({ email: m.display_name ?? m.user_id, password: res.temp_password });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const assignRole = async (userId: string, roleId: string) => {
    if (!currentShop) return;
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("assignRoleAction", userId, roleId);
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    }
    toast.success("Role updated"); load();
  };

  const openCreateRole = () => { setEditingRole(null); setRoleName(""); setRoleMatrix(new Set()); setOpenRole(true); };
  const openEditRole = (r: Role) => {
    setEditingRole(r); setRoleName(r.name);
    const set = new Set<string>();
    rolePerms.filter((rp) => rp.role_id === r.id).forEach((rp) => set.add(`${rp.module}:${rp.action}`));
    setRoleMatrix(set); setOpenRole(true);
  };
  const toggleCell = (m: Module, a: Action) => {
    const key = `${m}:${a}`; const next = new Set(roleMatrix);
    if (next.has(key)) next.delete(key); else next.add(key);
    setRoleMatrix(next);
  };
  const toggleRow = (m: Module) => {
    const allOn = ACTIONS.every((a) => roleMatrix.has(`${m}:${a}`));
    const next = new Set(roleMatrix);
    ACTIONS.forEach((a) => allOn ? next.delete(`${m}:${a}`) : next.add(`${m}:${a}`));
    setRoleMatrix(next);
  };

  const saveRole = async () => {
    if (!currentShop || !roleName.trim()) return toast.error("Role name required");
    const permissions = Array.from(roleMatrix);
    try {
      const res = editingRole
        ? await rpc<{ ok: boolean; error?: string }>("updateRoleAction", editingRole.id, { name: roleName.trim(), permissions })
        : await rpc<{ ok: boolean; error?: string }>("createRoleAction", { name: roleName.trim(), permissions });
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    }
    toast.success(editingRole ? "Role updated" : "Role created");
    setOpenRole(false); load();
  };

  const removeRole = async (r: Role) => {
    if (r.is_system) return toast.error("Cannot delete system role");
    if (!(await confirm({ title: "Delete role?", description: `"${r.name}" will be removed.`, variant: "destructive" }))) return;
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("deleteRoleAction", r.id);
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    }
    toast.success("Deleted"); load();
  };

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copied"); };

  if (!isAdmin) {
    return <div className="p-8 text-center text-muted-foreground">Only owners and managers can manage staff & roles.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="size-6 text-primary" /> Staff & Roles</h1>
        <p className="text-sm text-muted-foreground">Manage your team and per-module permissions</p>
      </div>

      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setOpenCreate(true)}><UserPlus className="size-4 mr-2" /> Add staff</Button>
          </div>
          <Card className="overflow-hidden">
            {loading ? <div className="p-8 text-center text-muted-foreground">Loading…</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3">Member</th>
                      <th className="text-left px-4 py-3">Role</th>
                      <th className="text-right px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {members.map((m) => {
                      const ura = assignments.find((a) => a.user_id === m.user_id);
                      const isOwner = m.role === "owner";
                      return (
                        <tr key={m.user_id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">
                            <div>{m.display_name ?? "—"}
                              {isOwner && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">Owner</span>}
                              {m.disabled && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">Blocked</span>}
                              {m.user_id === user?.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                            </div>
                            {usernames[m.user_id] && <div className="text-xs text-muted-foreground font-normal">@{usernames[m.user_id]}</div>}
                          </td>
                          <td className="px-4 py-3">
                            {isOwner ? <span className="text-muted-foreground">—</span> : (
                              <Select value={ura?.role_id ?? "__none"} onValueChange={(v) => assignRole(m.user_id, v)}>
                                <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none">— No role —</SelectItem>
                                  {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                            {!isOwner && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => setEditStaff({ user_id: m.user_id, full_name: m.display_name ?? "", username: usernames[m.user_id] ?? "" })} title="Edit"><Pencil className="size-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => resetPwd(m)} title="Reset password"><KeyRound className="size-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => toggleBlocked(m)} title={m.disabled ? "Unblock" : "Block"}>
                                  {m.disabled ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Ban className="size-4 text-amber-600" />}
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => removeStaff(m)} className="text-destructive hover:text-destructive"><Trash2 className="size-4" /></Button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateRole}><Plus className="size-4 mr-2" /> New role</Button>
          </div>
          <div className="grid gap-3">
            {roles.map((r) => {
              const count = rolePerms.filter((rp) => rp.role_id === r.id).length;
              return (
                <Card key={r.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><ShieldCheck className="size-5" /></div>
                    <div>
                      <div className="font-medium">{r.name} {r.is_system && <span className="ml-1 text-xs text-muted-foreground">(system)</span>}</div>
                      <div className="text-xs text-muted-foreground">{count} permissions</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => openEditRole(r)}>Edit</Button>
                    {!r.is_system && <Button variant="ghost" size="icon" onClick={() => removeRole(r)} className="text-destructive hover:text-destructive"><Trash2 className="size-4" /></Button>}
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create staff */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add staff</DialogTitle>
            <DialogDescription>A unique username and temporary password will be generated. Share them securely.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Full name *</Label><Input value={newStaff.full_name} onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })} autoFocus /></div>
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Select value={newStaff.role_id} onValueChange={(v) => setNewStaff({ ...newStaff, role_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pick a role" /></SelectTrigger>
                <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button>
            <Button onClick={createStaff} disabled={creating}>{creating ? "Creating…" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Created credentials */}
      <Dialog open={!!createdCreds} onOpenChange={(o) => !o && setCreatedCreds(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Staff created</DialogTitle><DialogDescription>Share these credentials securely. The password won't be shown again.</DialogDescription></DialogHeader>
          {createdCreds && (
            <div className="space-y-2">
              <div><div className="text-xs text-muted-foreground mb-1">Username</div><div className="bg-muted/40 border rounded-lg p-3 font-mono text-sm flex items-center justify-between"><span>{createdCreds.username}</span><Button variant="ghost" size="icon" onClick={() => copy(createdCreds.username)}><Copy className="size-3.5" /></Button></div></div>
              <div><div className="text-xs text-muted-foreground mb-1">Password</div><div className="bg-muted/40 border rounded-lg p-3 font-mono text-sm flex items-center justify-between"><span>{createdCreds.password}</span><Button variant="ghost" size="icon" onClick={() => copy(createdCreds.password)}><Copy className="size-3.5" /></Button></div></div>
            </div>
          )}
          <DialogFooter><Button onClick={() => setCreatedCreds(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset credentials */}
      <Dialog open={!!resetCreds} onOpenChange={(o) => !o && setResetCreds(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New temporary password</DialogTitle><DialogDescription>Share securely. Won't be shown again.</DialogDescription></DialogHeader>
          {resetCreds && (
            <div className="bg-muted/40 border rounded-lg p-3 font-mono text-sm flex items-center justify-between">
              <span>{resetCreds.password}</span>
              <Button variant="ghost" size="icon" onClick={() => copy(resetCreds.password)}><Copy className="size-3.5" /></Button>
            </div>
          )}
          <DialogFooter><Button onClick={() => setResetCreds(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role editor */}
      <Dialog open={openRole} onOpenChange={setOpenRole}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit role" : "New role"}</DialogTitle>
            <DialogDescription>Pick which modules this role can view and modify.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Role name</Label>
              <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} disabled={editingRole?.is_system} />
              {editingRole?.is_system && <p className="text-xs text-muted-foreground">System role name can't be changed, but permissions are editable.</p>}
            </div>
            <div className="border rounded-lg overflow-x-auto max-h-[55vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">Module</th>
                    {ACTIONS.map((a) => (
                      <th key={a} className="px-3 py-2 text-center" title={ACTION_HINT[a]}>{ACTION_LABEL[a]}</th>
                    ))}
                    <th className="px-3 py-2 text-center">All</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {MODULES.map((m) => (
                    <tr key={m}>
                      <td className="px-3 py-2 font-medium">{MODULE_LABEL[m]}</td>
                      {ACTIONS.map((a) => (
                        <td key={a} className="px-3 py-2 text-center">
                          <Checkbox
                            checked={roleMatrix.has(`${m}:${a}`)}
                            onCheckedChange={() => toggleCell(m, a)}
                          
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center">
                        <Button type="button" size="sm" variant="ghost" onClick={() => toggleRow(m)}>Toggle</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenRole(false)}>Cancel</Button>
            <Button onClick={saveRole}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit staff */}
      <Dialog open={!!editStaff} onOpenChange={(o) => !o && setEditStaff(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit staff</DialogTitle>
            <DialogDescription>Update the member's name or username.</DialogDescription>
          </DialogHeader>
          {editStaff && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Full name</Label><Input value={editStaff.full_name} onChange={(e) => setEditStaff({ ...editStaff, full_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Username</Label><Input value={editStaff.username} onChange={(e) => setEditStaff({ ...editStaff, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStaff(null)}>Cancel</Button>
            <Button
              disabled={savingEdit}
              onClick={async () => {
                if (!editStaff || !currentShop) return;
                setSavingEdit(true);
                try {
                  const res = await rpc<{ ok: boolean; error?: string }>("updateStaffAction", {
                    user_id: editStaff.user_id,
                    full_name: editStaff.full_name,
                    username: editStaff.username,
                  });
                  if (!res.ok) return toast.error(res.error ?? "Failed");
                } catch (e) {
                  return toast.error(e instanceof Error ? e.message : "Failed");
                } finally {
                  setSavingEdit(false);
                }
                toast.success("Updated");
                setEditStaff(null);
                load();
              }}
            >{savingEdit ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
