"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, UserPlus, Trash2, Loader2, Building2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStaffUsers } from "@/features/staff-users/hooks/use-staff-users";
import { useRoles, useAssignRole, useUnassignRole, useRoleAssignments } from "@/features/rbac/hooks/use-rbac";
import { useClinics } from "@/features/clinics/hooks/use-clinics";
import { useQueryClient } from "@tanstack/react-query";
import { rbacKeys } from "@/features/rbac/hooks/use-rbac";

export default function AssignStaffPage() {
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [staffUserId, setStaffUserId] = useState("");
  const [roleId, setRoleId]           = useState("");
  const [clinicId, setClinicId]       = useState("__global__");

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data: staffData }   = useStaffUsers({ limit: 100 });
  const { data: rolesData }   = useRoles({ limit: 100 });
  const { data: clinicsData } = useClinics({ limit: 100 });
  const { data: assignments, isLoading: loadingAssignments } = useRoleAssignments({ limit: 50 });

  const staffList  = staffData?.data  ?? [];
  const rolesList  = rolesData?.data  ?? [];
  const clinicList = clinicsData?.data ?? [];
  const rows       = assignments?.data ?? [];

  // ── Mutations ──────────────────────────────────────────────────────────────
  const assignMutation   = useAssignRole();
  const unassignMutation = useUnassignRole();

  const handleAssign = () => {
    if (!staffUserId || !roleId) return;
    assignMutation.mutate(
      {
        staffUserId,
        roleId,
        clinicId: clinicId !== "__global__" ? clinicId : undefined,
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: rbacKeys.assignments() });
          setStaffUserId("");
          setRoleId("");
          setClinicId("__global__");
        },
      }
    );
  };

  const handleRemove = (row: { staffUserId: string; roleId: string }) => {
    unassignMutation.mutate(
      { staffUserId: row.staffUserId, roleId: row.roleId },
      { onSuccess: () => qc.invalidateQueries({ queryKey: rbacKeys.assignments() }) }
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Assign Staff to Clinic</h1>
          <p className="text-sm text-muted-foreground">Grant a role to a staff user, optionally scoped to a clinic.</p>
        </div>
      </div>

      {/* Assignment form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-muted-foreground" />
            New Assignment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Staff user */}
            <div className="space-y-2">
              <Label>Staff User <span className="text-destructive">*</span></Label>
              <Select value={staffUserId} onValueChange={setStaffUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff user…" />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <div className="flex flex-col">
                        <span>{u.name}</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label>Role <span className="text-destructive">*</span></Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role…" />
                </SelectTrigger>
                <SelectContent>
                  {rolesList.map((r) => (
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

            {/* Clinic */}
            <div className="space-y-2">
              <Label>Clinic</Label>
              <Select value={clinicId} onValueChange={setClinicId}>
                <SelectTrigger>
                  <SelectValue placeholder="No clinic (global)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__global__">
                    <span className="text-muted-foreground">No clinic (global)</span>
                  </SelectItem>
                  {clinicList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleAssign}
              disabled={!staffUserId || !roleId || assignMutation.isPending}
            >
              {assignMutation.isPending
                ? <Loader2 className="h-4 w-4 me-2 animate-spin" />
                : <UserPlus className="h-4 w-4 me-2" />
              }
              Assign Role
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current assignments table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Current Assignments
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingAssignments ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No assignments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Clinic</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{row.staffUserName}</p>
                        <p className="text-xs text-muted-foreground">{row.staffUserEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <Shield className="h-3 w-3" />
                        {row.roleName}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {row.clinicName
                        ? <span className="flex items-center gap-1 text-sm">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            {row.clinicName}
                          </span>
                        : <span className="text-xs text-muted-foreground">Global</span>
                      }
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(row.assignedAt), "PP")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={unassignMutation.isPending}
                        onClick={() => handleRemove(row)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
