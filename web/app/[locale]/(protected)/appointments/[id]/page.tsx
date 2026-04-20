"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowLeft, X, Check, UserX, Loader2, User, Stethoscope, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useAppointment,
  useAppointmentHistory,
  useUpdateAppointment,
  useCancelAppointment,
} from "@/features/appointments/hooks/use-appointments";
import type { AppointmentStatus } from "@/features/appointments/types/appointment.types";

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  confirmed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  no_show:   "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const STATUS_DOT: Record<AppointmentStatus, string> = {
  pending:   "bg-yellow-400",
  confirmed: "bg-green-500",
  cancelled: "bg-red-500",
  completed: "bg-blue-500",
  no_show:   "bg-gray-400",
};

function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 py-2.5">
      <span className="text-sm text-muted-foreground w-44 shrink-0">{label}</span>
      <span className="text-sm font-medium break-all">{value || "—"}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: appt, isLoading } = useAppointment(id);
  const { data: history = [], isLoading: historyLoading } = useAppointmentHistory(id);
  const updateMutation = useUpdateAppointment(id);
  const cancelMutation = useCancelAppointment();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-2xl">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!appt) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Appointment not found.</p>
      </div>
    );
  }

  const canConfirm  = appt.status === "pending";
  const canComplete = appt.status === "confirmed";
  const canNoShow   = appt.status === "confirmed";
  const canCancel   = ["pending", "confirmed"].includes(appt.status);

  return (
    <div className="p-6 space-y-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{appt.title}</h1>
            <div className="mt-1">
              <StatusBadge status={appt.status} />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          {canConfirm && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ status: "confirmed" })}
            >
              {updateMutation.isPending
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Check className="h-3 w-3 me-1" />
              }
              Confirm
            </Button>
          )}
          {canComplete && (
            <Button
              size="sm"
              variant="outline"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ status: "completed" })}
            >
              Complete
            </Button>
          )}
          {canNoShow && (
            <Button
              size="sm"
              variant="outline"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ status: "no_show" })}
            >
              <UserX className="h-3 w-3 me-1" /> No Show
            </Button>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={() => { setCancelOpen(true); setCancelReason(""); }}
            >
              <X className="h-3 w-3 me-1" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {/* People */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Patient</p>
                <p className="text-sm font-medium truncate">
                  {appt.patientName ?? <span className="font-mono text-xs">{appt.patientId.slice(0, 12)}…</span>}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <Stethoscope className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Doctor</p>
                <p className="text-sm font-medium truncate">
                  {appt.doctorName ?? <span className="text-muted-foreground">Not assigned</span>}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <Card>
        <CardHeader><CardTitle className="text-base">Appointment Details</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <Row label="Scheduled At" value={format(new Date(appt.scheduledAt), "PPP · p")} />
          <Row label="Duration" value={`${appt.durationMinutes} minutes`} />
          <Row label="Status" value={appt.status.replace("_", " ")} />
          {appt.description && <Row label="Description" value={appt.description} />}
          {appt.notes && <Row label="Notes" value={appt.notes} />}
          {appt.slotId && <Row label="Slot ID" value={appt.slotId} />}
        </CardContent>
      </Card>

      {/* History timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Status History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No history yet.</p>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
              <div className="space-y-4">
                {history.map((entry) => (
                  <div key={entry.id} className="flex gap-4 relative">
                    {/* Dot */}
                    <div className={`h-6 w-6 rounded-full border-2 border-background shrink-0 flex items-center justify-center z-10 ${STATUS_DOT[entry.newStatus]}`} />
                    <div className="flex-1 pb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {entry.previousStatus ? (
                          <>
                            <StatusBadge status={entry.previousStatus} />
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <StatusBadge status={entry.newStatus} />
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-muted-foreground">Created as</span>
                            <StatusBadge status={entry.newStatus} />
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span title={format(new Date(entry.changedAt), "PPP p")}>
                          {formatDistanceToNow(new Date(entry.changedAt), { addSuffix: true })}
                        </span>
                        {entry.reason && (
                          <>
                            <span>·</span>
                            <span className="italic">{entry.reason}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Meta */}
      <p className="text-xs text-muted-foreground">
        Created {format(new Date(appt.createdAt), "PPP")} ·
        Updated {format(new Date(appt.updatedAt), "PPP")}
      </p>

      {/* Cancel dialog */}
      <Dialog open={cancelOpen} onOpenChange={(o) => !o && setCancelOpen(false)}>
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
              placeholder="e.g. Patient requested cancellation"
            />
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Back</Button>
            <Button
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={() =>
                cancelMutation.mutate(
                  { id, reason: cancelReason || undefined },
                  { onSuccess: () => setCancelOpen(false) }
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
