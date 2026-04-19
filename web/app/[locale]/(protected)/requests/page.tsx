"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Check, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequestStatusBadge } from "@/features/requests/components/request-status-badge";
import {
  usePatientRequests, useApprovePatientRequest, useRejectPatientRequest,
  useDoctorRequests, useApproveDoctorRequest, useRejectDoctorRequest,
} from "@/features/requests/hooks/use-requests";
import { useAuthStore } from "@/stores/auth.store";
import type { PatientRequestStatus, DoctorRequestStatus } from "@/features/requests/types/request.types";

// ─── Shared dialogs ───────────────────────────────────────────────────────────

function RejectDialog({ open, onClose, onConfirm, loading }: {
  open: boolean; onClose: () => void; onConfirm: (reason: string) => void; loading: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reject Request</DialogTitle>
          <DialogDescription>Provide a reason for rejection.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Reason</Label>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} />
        </div>
        <div className="flex justify-end gap-3 mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={loading || !reason.trim()} onClick={() => onConfirm(reason)}>
            {loading && <Loader2 className="h-4 w-4 me-2 animate-spin" />} Reject
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssignClinicDialog({ open, onClose, onConfirm, loading }: {
  open: boolean; onClose: () => void; onConfirm: (clinicId: string) => void; loading: boolean;
}) {
  const [clinicId, setClinicId] = useState("");
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Assign Clinic</DialogTitle>
          <DialogDescription>Assign this unassigned request to a clinic before approving.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Clinic ID</Label>
          <Input value={clinicId} onChange={e => setClinicId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          <p className="text-xs text-muted-foreground">Get the clinic ID from the Clinics page.</p>
        </div>
        <div className="flex justify-end gap-3 mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={loading || !clinicId.trim()} onClick={() => onConfirm(clinicId)}>
            {loading && <Loader2 className="h-4 w-4 me-2 animate-spin" />} Assign
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Patient requests table ───────────────────────────────────────────────────

function PatientRequestsTable({ isGlobal }: { isGlobal: boolean }) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<PatientRequestStatus | "all">("all");
  const [rejectId, setRejectId] = useState<string | null>(null);

  const { data, isLoading } = usePatientRequests({
    page,
    limit: 20,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const approveMutation = useApprovePatientRequest();
  const rejectMutation  = useRejectPatientRequest();

  const requests = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1); }}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Patient</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-end">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : requests.length === 0
                ? <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No requests found</TableCell></TableRow>
                : requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="font-medium">{r.name}</p>
                      {r.email && <p className="text-xs text-muted-foreground">{r.email}</p>}
                    </TableCell>
                    <TableCell className="text-sm">{r.phone}</TableCell>
                    <TableCell className="text-sm capitalize">{r.gender ?? "—"}</TableCell>
                    <TableCell><RequestStatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(r.createdAt), "PP")}</TableCell>
                    <TableCell>
                      {r.status === "pending" && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm" variant="outline"
                            className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950"
                            disabled={approveMutation.isPending}
                            onClick={() => approveMutation.mutate(r.id)}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                            onClick={() => setRejectId(r.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
            }
          </TableBody>
        </Table>
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={!meta.hasPrevPage} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span>Page {meta.page} of {meta.totalPages}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={!meta.hasNextPage} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      <RejectDialog
        open={!!rejectId} onClose={() => setRejectId(null)}
        loading={rejectMutation.isPending}
        onConfirm={(reason) => rejectMutation.mutate({ id: rejectId!, reason }, { onSuccess: () => setRejectId(null) })}
      />
    </div>
  );
}

// ─── Doctor requests table ────────────────────────────────────────────────────

function DoctorRequestsTable({ isGlobal }: { isGlobal: boolean }) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<DoctorRequestStatus | "all">("all");
  const [rejectId, setRejectId] = useState<string | null>(null);

  const { data, isLoading } = useDoctorRequests({
    page, limit: 20,
    status: statusFilter === "all" ? undefined : statusFilter,
    // Clinic staff only see join requests (API enforces this server-side too)
    type: isGlobal ? undefined : "join",
  });

  const approveMutation = useApproveDoctorRequest();
  const rejectMutation  = useRejectDoctorRequest();

  const requests = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1); }}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        {/* Super admin sees a note about create requests */}
        {isGlobal && (
          <p className="text-xs text-muted-foreground">
            Super admin can approve <strong>create-clinic</strong> requests. Clinic staff can only approve <strong>join</strong> requests.
          </p>
        )}
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Doctor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Specialty</TableHead>
              <TableHead>{isGlobal ? "Clinic / New Clinic" : "Clinic"}</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-end">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              : requests.length === 0
                ? <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No requests found</TableCell></TableRow>
                : requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.type === "create" ? "default" : "secondary"} className="capitalize">{r.type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm capitalize">{r.specialty.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm">
                      {r.type === "create"
                        ? <span className="font-medium">{r.clinicName}</span>
                        : <span className="font-mono text-xs text-muted-foreground">{r.clinicId?.slice(0, 8)}…</span>
                      }
                    </TableCell>
                    <TableCell><RequestStatusBadge status={r.status} /></TableCell>
                    <TableCell>
                      {r.status === "pending" && (
                        <div className="flex items-center justify-end gap-1">
                          {/* create-clinic requests: super admin only */}
                          {(r.type === "join" || isGlobal) && (
                            <Button size="sm" variant="outline"
                              className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950"
                              disabled={approveMutation.isPending}
                              onClick={() => approveMutation.mutate(r.id)}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                          <Button size="sm" variant="outline"
                            className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                            onClick={() => setRejectId(r.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
            }
          </TableBody>
        </Table>
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={!meta.hasPrevPage} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span>Page {meta.page} of {meta.totalPages}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={!meta.hasNextPage} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      <RejectDialog
        open={!!rejectId} onClose={() => setRejectId(null)}
        loading={rejectMutation.isPending}
        onConfirm={(reason) => rejectMutation.mutate({ id: rejectId!, reason }, { onSuccess: () => setRejectId(null) })}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RequestsPage() {
  const user = useAuthStore((s) => s.user);
  const isGlobal = !user?.clinicId; // true = super admin

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isGlobal
            ? "Review all patient and doctor registration requests across all clinics."
            : "Review patient and doctor registration requests for your clinic."
          }
        </p>
      </div>

      <Tabs defaultValue="patients">
        <TabsList>
          <TabsTrigger value="patients">Patient Requests</TabsTrigger>
          <TabsTrigger value="doctors">Doctor Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="patients" className="mt-4">
          <PatientRequestsTable />
        </TabsContent>

        <TabsContent value="doctors" className="mt-4">
          <DoctorRequestsTable isGlobal={isGlobal} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
