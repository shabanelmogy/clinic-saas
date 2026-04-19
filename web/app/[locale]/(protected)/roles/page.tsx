"use client";

import { useState, useEffect } from "react";
import { Shield, Plus, Trash2, ChevronDown, ChevronRight, Loader2, UserPlus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  useRoles, useRole, usePermissions,
  useCreateRole, useUpdateRole, useDeleteRole,
  useAssignRole,
} from "@/features/rbac/hooks/use-rbac";
import type { Permission } from "@/features/rbac/types/rbac.types";

// ─── Permission picker grouped by category ────────────────────────────────────

function PermissionPicker({
  permissions,
  selected,
  onChange,
}: {
  permissions: Permission[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  const toggleCategory = (cat: string) => {
    const ids = grouped[cat].map((p) => p.id);
    const allSelected = ids.every((id) => selected.includes(id));
    onChange(allSelected ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])]);
  };

  return (
    <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
      {Object.entries(grouped).map(([category, perms]) => {
        const allSelected = perms.every((p) => selected.includes(p.id));
        const someSelected = perms.some((p) => selected.includes(p.id));
        const open = expanded[category] ?? false;

        return (
          <div key={category}>
            <button
              type="button"
              className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/50 text-sm font-medium capitalize"
              onClick={() => setExpanded((e) => ({ ...e, [category]: !open }))}
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allSelected}
                  data-state={someSelected && !allSelected ? "indeterminate" : undefined}
                  onCheckedChange={() => toggleCategory(category)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span>{category}</span>
                <Badge variant="secondary" className="text-xs">{perms.length}</Badge>
              </div>
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
            {open && (
              <div className="px-3 pb-2 space-y-1 bg-muted/20">
                {perms.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 py-1 cursor-pointer text-sm">
                    <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                    <span className="font-mono text-xs text-muted-foreground">{p.key}</span>
                    <span className="text-xs">{p.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Role detail panel ────────────────────────────────────────────────────────

function RoleDetail({ roleId, onDelete }: { roleId: string; onDelete: () => void }) {
  const { data: role, isLoading } = useRole(roleId);
  const { data: permissions = [] } = usePermissions();
  const deleteMutation = useDeleteRole();
  const updateMutation = useUpdateRole(roleId);
  const assignMutation = useAssignRole();

  const [editingPermissions, setEditingPermissions] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [staffUserId, setStaffUserId] = useState("");

  // When role loads or roleId changes, sync selectedIds
  useEffect(() => {
    if (role?.permissions) {
      setSelectedIds(role.permissions.map((p) => p.id));
    }
  }, [role]);

  if (isLoading) return (
    <div className="p-6 space-y-3">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
    </div>
  );
  if (!role) return null;

  const isGlobal = !role.clinicId;

  const handleSavePermissions = () => {
    updateMutation.mutate(
      { permissionIds: selectedIds },
      { onSuccess: () => setEditingPermissions(false) }
    );
  };

  const handleCancelEdit = () => {
    // Reset to current saved permissions
    setSelectedIds(role.permissions?.map((p) => p.id) ?? []);
    setEditingPermissions(false);
  };

  // Group current permissions by category for read view
  const grouped = (role.permissions ?? []).reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{role.name}</h2>
          {role.description && <p className="text-sm text-muted-foreground mt-0.5">{role.description}</p>}
          <div className="flex gap-2 mt-2">
            <Badge variant={isGlobal ? "default" : "secondary"}>{isGlobal ? "Global" : "Clinic-scoped"}</Badge>
            <Badge variant="outline">{role.permissions?.length ?? 0} permissions</Badge>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
            <UserPlus className="h-3 w-3 me-1" /> Assign
          </Button>
          {!isGlobal && (
            <Button size="sm" variant="destructive" disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(roleId, { onSuccess: onDelete })}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Permissions section */}
      <div className="flex-1 space-y-3 min-h-0">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Permissions
          </p>
          {/* Only clinic-scoped roles can be edited */}
          {!isGlobal && !editingPermissions && (
            <Button size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => setEditingPermissions(true)}>
              <Pencil className="h-3 w-3 me-1" /> Edit
            </Button>
          )}
          {isGlobal && (
            <span className="text-xs text-muted-foreground">Global roles are read-only</span>
          )}
        </div>

        {/* ── Edit mode — full permission picker ─────────────────────────── */}
        {editingPermissions ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Check/uncheck permissions. Click <strong>Save</strong> to apply — this replaces all current permissions.
            </p>
            <PermissionPicker
              permissions={permissions}
              selected={selectedIds}
              onChange={setSelectedIds}
            />
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">{selectedIds.length} selected</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                <Button size="sm" disabled={updateMutation.isPending} onClick={handleSavePermissions}>
                  {updateMutation.isPending && <Loader2 className="h-3 w-3 me-1 animate-spin" />}
                  Save
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* ── Read mode — grouped badges ──────────────────────────────── */
          <div className="space-y-3 overflow-y-auto max-h-80">
            {Object.keys(grouped).length === 0
              ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">No permissions assigned.</p>
                  {!isGlobal && (
                    <Button size="sm" variant="outline" className="mt-2"
                      onClick={() => setEditingPermissions(true)}>
                      <Plus className="h-3 w-3 me-1" /> Add permissions
                    </Button>
                  )}
                </div>
              )
              : Object.entries(grouped).map(([cat, perms]) => (
                <div key={cat}>
                  <p className="text-xs font-medium capitalize text-muted-foreground mb-1">{cat}</p>
                  <div className="flex flex-wrap gap-1">
                    {perms.map((p) => (
                      <span key={p.id}
                        className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono bg-muted text-muted-foreground">
                        {p.key}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>

      {/* Assign role dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>Assign "{role.name}" to a staff user by their ID.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Staff User ID</Label>
            <Input value={staffUserId} onChange={e => setStaffUserId(e.target.value)} placeholder="uuid" />
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button disabled={assignMutation.isPending || !staffUserId.trim()}
              onClick={() => assignMutation.mutate(
                { staffUserId, roleId },
                { onSuccess: () => { setAssignOpen(false); setStaffUserId(""); } }
              )}>
              {assignMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />} Assign
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const [search, setSearch] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", permissionIds: [] as string[] });

  const { data, isLoading } = useRoles({ limit: 50, search: search || undefined });
  const { data: permissions = [] } = usePermissions();
  const createMutation = useCreateRole();

  const roles = data?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Roles & Permissions</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage roles and their permission sets.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 me-2" /> New Role
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[500px]">

        {/* ── Role list ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-1 border rounded-lg overflow-hidden flex flex-col">
          <div className="p-3 border-b bg-muted/30">
            <Input placeholder="Search roles..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="flex-1 overflow-y-auto divide-y">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="p-3"><Skeleton className="h-5 w-full" /></div>)
              : roles.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-8">No roles found</p>
                : roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRoleId(role.id)}
                    className={cn(
                      "w-full text-start px-4 py-3 hover:bg-muted/50 transition-colors",
                      selectedRoleId === role.id && "bg-muted"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm font-medium truncate">{role.name}</span>
                      </div>
                      <Badge variant={role.clinicId ? "secondary" : "default"} className="text-xs shrink-0">
                        {role.clinicId ? "clinic" : "global"}
                      </Badge>
                    </div>
                    {role.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate ps-6">{role.description}</p>
                    )}
                  </button>
                ))
            }
          </div>
        </div>

        {/* ── Role detail ────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 border rounded-lg overflow-hidden">
          {selectedRoleId
            ? <RoleDetail roleId={selectedRoleId} onDelete={() => setSelectedRoleId(null)} />
            : (
              <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
                <Shield className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Select a role to view details</p>
              </div>
            )
          }
        </div>
      </div>

      {/* Create role dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Role</DialogTitle>
            <DialogDescription>Define a new clinic-scoped role with specific permissions.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(
              { name: form.name, description: form.description || undefined, permissionIds: form.permissionIds },
              { onSuccess: () => { setCreateOpen(false); setForm({ name: "", description: "", permissionIds: [] }); } }
            );
          }}>
            <div className="space-y-2">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Permissions ({form.permissionIds.length} selected)</Label>
              <PermissionPicker
                permissions={permissions}
                selected={form.permissionIds}
                onChange={(ids) => setForm(f => ({ ...f, permissionIds: ids }))}
              />
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              Create Role
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
