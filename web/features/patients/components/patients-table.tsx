"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, MoreHorizontal, Eye, Pencil, Trash2, UserPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { GenderBadge, BloodTypeBadge, StatusBadge } from "./patient-badge";
import { usePatients, useDeletePatient } from "../hooks/use-patients";

// Install alert-dialog if not present — using dialog as fallback
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PatientForm } from "./patient-form";
import { useCreatePatient } from "../hooks/use-patients";

export function PatientsTable() {
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = usePatients({ page, limit: 20, search: search || undefined });
  const createMutation = useCreatePatient();
  const deleteMutation = useDeletePatient();

  const patients = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patients..."
            className="ps-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4 me-2" />
          Add Patient
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Blood Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : patients.length === 0
                ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No patients found
                    </TableCell>
                  </TableRow>
                )
                : patients.map((patient) => (
                  <TableRow
                    key={patient.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/${locale}/patients/${patient.id}`)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{patient.name}</p>
                        {patient.email && (
                          <p className="text-xs text-muted-foreground">{patient.email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{patient.phone ?? "—"}</TableCell>
                    <TableCell><GenderBadge gender={patient.gender} /></TableCell>
                    <TableCell><BloodTypeBadge bloodType={patient.bloodType} /></TableCell>
                    <TableCell><StatusBadge isActive={patient.isActive} /></TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/${locale}/patients/${patient.id}`)}>
                            <Eye className="h-4 w-4 me-2" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/${locale}/patients/${patient.id}/edit`)}>
                            <Pencil className="h-4 w-4 me-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(patient.id)}
                          >
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

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{meta.total} patients total</span>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Patient</DialogTitle>
            <DialogDescription>Fill in the patient details below.</DialogDescription>
          </DialogHeader>
          <PatientForm
            mode="create"
            loading={createMutation.isPending}
            onSubmit={(data) =>
              createMutation.mutate(data as Parameters<typeof createMutation.mutate>[0], {
                onSuccess: () => setCreateOpen(false),
              })
            }
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Patient</DialogTitle>
            <DialogDescription>
              This will soft-delete the patient. Their records will be preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteId) deleteMutation.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
