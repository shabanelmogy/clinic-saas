"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { Plus, MoreHorizontal, Eye, X, ChevronLeft, ChevronRight, Loader2, User, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useAppointments,
  useCreateAppointment,
  useCancelAppointment,
  useDeleteAppointment,
} from "@/features/appointments/hooks/use-appointments";
import type { AppointmentStatus, CreateAppointmentInput } from "@/features/appointments/types/appointment.types";

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  confirmed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  no_show:   "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "all">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const [form, setForm] = useState<CreateAppointmentInput>({
    title: "",
    scheduledAt: "",
    durationMinutes: 60,
  });

  const { data, isLoading } = useAppointments({
    page,
    limit: 20,
    status: statusFilter === "all" ? undefined : statusFilter,
    from: fromDate ? new Date(fromDate).toISOString() : undefined,
    to:   toDate   ? new Date(toDate).toISOString()   : undefined,
  });

  const createMutation = useCreateAppointment();
  const cancelMutation = useCancelAppointment();
  const deleteMutation = useDeleteAppointment();

  const appointments = data?.data ?? [];
  const meta = data?.meta;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const iso = form.scheduledAt ? new Date(form.scheduledAt).toISOString() : "";
    createMutation.mutate(
      { ...form, scheduledAt: iso },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setForm({ title: "", scheduledAt: "", durationMinutes: 60 });
        },
      }
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Appointments</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage all clinic appointments.</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={statusFilter}
          onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1); }}
        >
          <SelectTrigger className="w-40 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(["pending", "confirmed", "completed", "cancelled", "no_show"] as AppointmentStatus[]).map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="h-9 w-36 text-sm"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            title="From date"
          />
          <span className="text-muted-foreground text-sm">–</span>
          <Input
            type="date"
            className="h-9 w-36 text-sm"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            title="To date"
          />
          {(fromDate || toDate) && (
            <Button variant="ghost" size="sm" onClick={() => { setFromDate(""); setToDate(""); }}>
              Clear
            </Button>
          )}
        </div>

        <div className="ms-auto">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 me-2" /> New Appointment
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Title</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : appointments.length === 0
                ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No appointments found
                    </TableCell>
                  </TableRow>
                )
                : appointments.map((a) => (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/${locale}/appointments/${a.id}`)}
                  >
                    <TableCell>
                      <p className="font-medium">{a.title}</p>
                      {a.notes && (
                        <p className="text-xs text-muted-foreground truncate max-w-40">{a.notes}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {a.patientName ? (
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-sm">{a.patientName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground font-mono">{a.patientId.slice(0, 8)}…</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {a.doctorName ? (
                        <div className="flex items-center gap-1.5">
                          <Stethoscope className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-sm">{a.doctorName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <p>{format(new Date(a.scheduledAt), "PP")}</p>
                      <p className="text-muted-foreground">{format(new Date(a.scheduledAt), "p")}</p>
                    </TableCell>
                    <TableCell className="text-sm">{a.durationMinutes} min</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/${locale}/appointments/${a.id}`)}>
                            <Eye className="h-4 w-4 me-2" /> View
                          </DropdownMenuItem>
                          {["pending", "confirmed"].includes(a.status) && (
                            <DropdownMenuItem
                              className="text-orange-600"
                              onClick={() => { setCancelId(a.id); setCancelReason(""); }}
                            >
                              <X className="h-4 w-4 me-2" /> Cancel
                            </DropdownMenuItem>
                          )}
                          {a.status !== "confirmed" && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(a.id)}
                            >
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
            }
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{meta.total} appointments total</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="icon" className="h-8 w-8"
              disabled={!meta.hasPrevPage}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>Page {meta.page} of {meta.totalPages}</span>
            <Button
              variant="outline" size="icon" className="h-8 w-8"
              disabled={!meta.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Appointment</DialogTitle>
            <DialogDescription>
              Create a walk-in appointment. Your clinic is used automatically.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Initial Consultation"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>
                Patient ID <span className="text-muted-foreground text-xs">(required for staff)</span>
              </Label>
              <Input
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={form.patientId ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value || undefined }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Doctor ID <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={form.slotId ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, slotId: e.target.value || undefined }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Scheduled At <span className="text-destructive">*</span></Label>
                <Input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Duration (min)</Label>
                <Input
                  type="number" min={5} max={480}
                  value={form.durationMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, durationMinutes: +e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || undefined }))}
              />
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              Create Appointment
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>This will release the linked slot if any.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setCancelId(null)}>Back</Button>
            <Button
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={() =>
                cancelMutation.mutate(
                  { id: cancelId!, reason: cancelReason || undefined },
                  { onSuccess: () => setCancelId(null) }
                )
              }
            >
              {cancelMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              Cancel Appointment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
