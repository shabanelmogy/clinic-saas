"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Pencil, Trash2, Shield, Plus, X, Loader2, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStaffUser, useDeleteStaffUser } from "@/features/staff-users/hooks/use-staff-users";
import { useRoles, useAssignRole, useUnassignRole } from "@/features/rbac/hooks/use-rbac";
import { useClinics } from "@/features/clinics/hooks/use-clinics";
import { useAuthStore } from "@/stores/auth.store";

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2.5">
      <span className="text-sm text-muted-foreground w-36 shrink-0">{label}</span>
      <span className="text-sm font-medium break-all">{value || "—"}</span>
    </div>
  );
}

export default function StaffUserDetailPage() {
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const router = useRouter();

  const { data: user, isLoading } = useStaffUser(id);
  const deleteMutation  = useDeleteStaffUser();
  const assignMutation  = useAssignRole();
  const unassignMutation = useUnassignRole();

  const currentUser = useAuthStore((s) => s.user);
  const isGlobal = !currentUser?.clinicId; // Super Admin

  // All roles — for the assign dropdown
  const { data: rolesData } = useRoles({ limit: 100 });
  const allRoles = rolesData?.data ?? [];

  // Clinics — only needed for super admin to pick a target clinic
  const { data: clinicsData } = useClinics({ limit: 100 });
  const allClinics = clinicsData?.data ?? [];

  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!user) {
    return <div className="p-6"><p className="text-muted-foreground">Staff user not found.</p></div>;
  }

  // Roles currently assigned to this user are not returned by GET /staff-users/:id
  // (the API returns the raw staff_users row). We show the assign/unassign UI
  // using the roles list — unassign requires knowing the roleId, so we let the
  // admin pick from the full roles list for both operations.

  return (
    <div className="p-6 space-y-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{user.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {user.isActive
                ? <Badge className="bg-green-100 text-green-700 border-0 dark:bg-green-900/30 dark:text-green-400">
                    <UserCheck className="h-3 w-3 me-1" /> Active
                  </Badge>
                : <Badge variant="secondary">
                    <UserX className="h-3 w-3 me-1" /> Inactive
                  </Badge>
              }
            </div>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => router.push(`/${locale}/staff-users/${id}/edit`)}
          >
            <Pencil className="h-4 w-4 me-2" /> Edit
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <Row label="Full Name" value={user.name} />
          <Row label="Email" value={user.email} />
          <Row label="Phone" value={user.phone} />
          <Row label="Status" value={user.isActive ? "Active" : "Inactive"} />
          <Row label="Created" value={format(new Date(user.createdAt), "PPP")} />
          <Row label="Last Updated" value={format(new Date(user.updatedAt), "PPP")} />
        </CardContent>
      </Card>

      {/* Role management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Role Management
          </CardTitle>
          <Button size="sm" onClick={() => { setSelectedRoleId(""); setAssignOpen(true); }}>
            <Plus className="h-3 w-3 me-1" /> Assign Role
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Use the assign button to grant a role to this user, or remove a role by selecting it below.
          </p>

          {/* Quick unassign — pick role to remove */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Remove a role</p>
            <div className="flex gap-2">
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger className="flex-1 h-9 text-sm">
                  <SelectValue placeholder="Select role to remove…" />
                </SelectTrigger>
                <SelectContent>
                  {allRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className="flex items-center gap-2">
                        {r.name}
                        <Badge variant={r.clinicId ? "secondary" : "default"} className="text-xs">
                          {r.clinicId ? "clinic" : "global"}
                        </Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                disabled={!selectedRoleId || unassignMutation.isPending}
                onClick={() =>
                  unassignMutation.mutate(
                    { staffUserId: id, roleId: selectedRoleId },
                    { onSuccess: () => setSelectedRoleId("") }
                  )
                }
              >
                {unassignMutation.isPending
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <X className="h-3 w-3" />
                }
                Remove
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assign role dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>
              Grant a role to <strong>{user.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select a role…" />
                </SelectTrigger>
                <SelectContent>
                  {allRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className="flex items-center gap-2">
                        {r.name}
                        <Badge variant={r.clinicId ? "secondary" : "default"} className="text-xs">
                          {r.clinicId ? "clinic" : "global"}
                        </Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Clinic picker — only for super admins */}
            {isGlobal && (
              <div className="space-y-2">
                <Label>Clinic <span className="text-muted-foreground text-xs">(optional — leave empty for global)</span></Label>
                <Select value={selectedClinicId} onValueChange={setSelectedClinicId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="No clinic (global assignment)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__global__">No clinic (global)</SelectItem>
                    {allClinics.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button
              disabled={!selectedRoleId || assignMutation.isPending}
              onClick={() =>
                assignMutation.mutate(
                  {
                    staffUserId: id,
                    roleId: selectedRoleId,
                    clinicId: (isGlobal && selectedClinicId && selectedClinicId !== "__global__")
                      ? selectedClinicId
                      : undefined,
                  },
                  { onSuccess: () => { setAssignOpen(false); setSelectedRoleId(""); setSelectedClinicId(""); } }
                )
              }
            >
              {assignMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              Assign
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Staff User</DialogTitle>
            <DialogDescription>
              This will soft-delete <strong>{user.name}</strong>. They will no longer be able to log in.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteMutation.mutate(id, {
                  onSuccess: () => router.push(`/${locale}/staff-users`),
                })
              }
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
