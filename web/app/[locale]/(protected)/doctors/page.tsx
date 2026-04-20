"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { UserPlus, Search, MoreHorizontal, Eye, Pencil, Trash2, ChevronLeft, ChevronRight, Loader2, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Input as FormInput } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDoctors, useCreateDoctor, useDeleteDoctor } from "@/features/doctors/hooks/use-doctors";
import { SPECIALTIES } from "@/features/doctors/types/doctor.types";
import type { CreateDoctorInput, DoctorSpecialty } from "@/features/doctors/types/doctor.types";

function SpecialtyBadge({ specialty }: { specialty: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 capitalize">
      {specialty.replace(/_/g, " ")}
    </span>
  );
}

export default function DoctorsPage() {
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateDoctorInput>({ name: "", specialty: "general_practice", isPublished: true });

  const { data, isLoading } = useDoctors({ page, limit: 20, search: search || undefined });
  const createMutation = useCreateDoctor();
  const deleteMutation = useDeleteDoctor();

  const doctors = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Doctors</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage clinic doctors, schedules and availability.</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search doctors..." className="ps-9" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4 me-2" /> Add Doctor
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Specialty</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              : doctors.length === 0
                ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No doctors found</TableCell></TableRow>
                : doctors.map((d) => (
                  <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/${locale}/doctors/${d.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Stethoscope className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{d.name}</p>
                          {d.email && <p className="text-xs text-muted-foreground">{d.email}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><SpecialtyBadge specialty={d.specialty} /></TableCell>
                    <TableCell className="text-sm">{d.phone ?? "—"}</TableCell>
                    <TableCell className="text-sm">{d.consultationFee ? `$${(d.consultationFee / 100).toFixed(0)}` : "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {d.isActive
                          ? <Badge className="bg-green-100 text-green-700 border-0 text-xs">Active</Badge>
                          : <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                        {d.isPublished
                          ? <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">Published</Badge>
                          : <Badge variant="outline" className="text-xs">Draft</Badge>}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/${locale}/doctors/${d.id}`)}>
                            <Eye className="h-4 w-4 me-2" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/${locale}/doctors/${d.id}/edit`)}>
                            <Pencil className="h-4 w-4 me-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(d.id)}>
                            <Trash2 className="h-4 w-4 me-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
            }
          </TableBody>
        </Table>
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{meta.total} doctors total</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={!meta.hasPrevPage} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span>Page {meta.page} of {meta.totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={!meta.hasNextPage} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Doctor</DialogTitle>
            <DialogDescription>Create a new doctor profile for this clinic.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form, { onSuccess: () => { setCreateOpen(false); setForm({ name: "", specialty: "general_practice", isPublished: true }); } }); }}>
            <div className="space-y-2"><Label>Name *</Label><FormInput value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div className="space-y-2">
              <Label>Specialty *</Label>
              <Select value={form.specialty} onValueChange={v => setForm(f => ({ ...f, specialty: v as DoctorSpecialty }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SPECIALTIES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Phone</Label><FormInput value={form.phone ?? ""} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Email</Label><FormInput type="email" value={form.email ?? ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Experience (yrs)</Label><FormInput type="number" min={0} max={70} value={form.experienceYears ?? ""} onChange={e => setForm(f => ({ ...f, experienceYears: e.target.value ? +e.target.value : undefined }))} /></div>
              <div className="space-y-2"><Label>Fee (cents)</Label><FormInput type="number" min={0} value={form.consultationFee ?? ""} onChange={e => setForm(f => ({ ...f, consultationFee: e.target.value ? +e.target.value : undefined }))} /></div>
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />} Create Doctor
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Doctor</DialogTitle><DialogDescription>This will soft-delete the doctor record.</DialogDescription></DialogHeader>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending}
              onClick={() => deleteId && deleteMutation.mutate(deleteId, { onSuccess: () => setDeleteId(null) })}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
