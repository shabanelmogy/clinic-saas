"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Pencil, Trash2, Calendar, Clock, Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDoctor, useDeleteDoctor, useDoctorSchedules, useUpsertSchedule, useDeleteSchedule, useGenerateSlots } from "@/features/doctors/hooks/use-doctors";
import { DAYS_OF_WEEK } from "@/features/doctors/types/doctor.types";
import type { DayOfWeek, UpsertScheduleInput } from "@/features/doctors/types/doctor.types";

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2">
      <span className="text-sm text-muted-foreground w-44 shrink-0">{label}</span>
      <span className="text-sm font-medium">{value || "—"}</span>
    </div>
  );
}

export default function DoctorDetailPage() {
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const router = useRouter();
  const { data: doctor, isLoading } = useDoctor(id);
  const { data: schedules = [] } = useDoctorSchedules(id);
  const deleteMutation = useDeleteDoctor();
  const upsertSchedule = useUpsertSchedule(id);
  const deleteSchedule = useDeleteSchedule(id);
  const generateSlots = useGenerateSlots();

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<UpsertScheduleInput>({
    dayOfWeek: "monday", startTime: "09:00", endTime: "17:00", slotDurationMinutes: 30, maxAppointments: 1, isActive: true,
  });
  const [genForm, setGenForm] = useState({ from: "", to: "" });

  if (isLoading) return <div className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  if (!doctor) return <div className="p-6"><p className="text-muted-foreground">Doctor not found.</p></div>;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">{doctor.name}</h1>
            <div className="flex gap-2 mt-1">
              <Badge className="capitalize bg-blue-100 text-blue-700 border-0">{doctor.specialty.replace(/_/g, " ")}</Badge>
              {doctor.isActive ? <Badge className="bg-green-100 text-green-700 border-0">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
              {doctor.isPublished ? <Badge className="bg-blue-100 text-blue-700 border-0">Published</Badge> : <Badge variant="outline">Draft</Badge>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/${locale}/doctors/${id}/edit`)}><Pencil className="h-4 w-4 me-2" /> Edit</Button>
          <Button variant="destructive" disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate(id, { onSuccess: () => router.push(`/${locale}/doctors`) })}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <Row label="Phone" value={doctor.phone} />
          <Row label="Email" value={doctor.email} />
          <Row label="Experience" value={doctor.experienceYears != null ? `${doctor.experienceYears} years` : null} />
          <Row label="Consultation Fee" value={doctor.consultationFee != null ? `$${(doctor.consultationFee / 100).toFixed(2)}` : null} />
          {doctor.bio && <Row label="Bio" value={doctor.bio} />}
        </CardContent>
      </Card>

      {/* Schedules */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Weekly Schedule</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setGenerateOpen(true)}>
              <Calendar className="h-3 w-3 me-1" /> Generate Slots
            </Button>
            <Button size="sm" onClick={() => setScheduleOpen(true)}>
              <Plus className="h-3 w-3 me-1" /> Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {schedules.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-4">No schedule rules. Add rules then generate slots.</p>
            : <div className="space-y-2">
                {DAYS_OF_WEEK.map(day => {
                  const s = schedules.find(sc => sc.dayOfWeek === day);
                  if (!s) return null;
                  return (
                    <div key={day} className="flex items-center justify-between rounded-lg border px-4 py-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium capitalize w-24">{day}</span>
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{s.startTime} – {s.endTime}</span>
                        <Badge variant="outline" className="text-xs">{s.slotDurationMinutes}min slots</Badge>
                        {!s.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteSchedule.mutate(day)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
          }
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Created {format(new Date(doctor.createdAt), "PPP")} · Updated {format(new Date(doctor.updatedAt), "PPP")}
      </p>

      {/* Add schedule dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Schedule Rule</DialogTitle><DialogDescription>Set availability for a specific day.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Day</Label>
              <Select value={scheduleForm.dayOfWeek} onValueChange={v => setScheduleForm(f => ({ ...f, dayOfWeek: v as DayOfWeek }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DAYS_OF_WEEK.map(d => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Start</Label><Input type="time" value={scheduleForm.startTime} onChange={e => setScheduleForm(f => ({ ...f, startTime: e.target.value }))} /></div>
              <div className="space-y-2"><Label>End</Label><Input type="time" value={scheduleForm.endTime} onChange={e => setScheduleForm(f => ({ ...f, endTime: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Slot (min)</Label><Input type="number" min={5} max={480} value={scheduleForm.slotDurationMinutes} onChange={e => setScheduleForm(f => ({ ...f, slotDurationMinutes: +e.target.value }))} /></div>
              <div className="space-y-2"><Label>Max/slot</Label><Input type="number" min={1} max={50} value={scheduleForm.maxAppointments} onChange={e => setScheduleForm(f => ({ ...f, maxAppointments: +e.target.value }))} /></div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancel</Button>
            <Button disabled={upsertSchedule.isPending}
              onClick={() => upsertSchedule.mutate(scheduleForm, { onSuccess: () => setScheduleOpen(false) })}>
              {upsertSchedule.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />} Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate slots dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Generate Slots</DialogTitle><DialogDescription>Generate bookable slots from schedule rules for a date range.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2"><Label>From</Label><Input type="datetime-local" value={genForm.from} onChange={e => setGenForm(f => ({ ...f, from: e.target.value }))} /></div>
            <div className="space-y-2"><Label>To</Label><Input type="datetime-local" value={genForm.to} onChange={e => setGenForm(f => ({ ...f, to: e.target.value }))} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
            <Button disabled={generateSlots.isPending || !genForm.from || !genForm.to}
              onClick={() => generateSlots.mutate(
                { doctorId: id, from: new Date(genForm.from).toISOString(), to: new Date(genForm.to).toISOString() },
                { onSuccess: () => setGenerateOpen(false) }
              )}>
              {generateSlots.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />} Generate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
