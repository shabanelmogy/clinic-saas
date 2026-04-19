"use client";

import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { GenderBadge, BloodTypeBadge, StatusBadge } from "@/features/patients/components/patient-badge";
import { usePatient, useDeletePatient } from "@/features/patients/hooks/use-patients";

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2">
      <span className="text-sm text-muted-foreground w-48 shrink-0">{label}</span>
      <span className="text-sm font-medium">{value || "—"}</span>
    </div>
  );
}

export default function PatientDetailPage() {
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const router = useRouter();
  const { data: patient, isLoading } = usePatient(id);
  const deleteMutation = useDeletePatient();

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Patient not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{patient.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge isActive={patient.isActive} />
              <GenderBadge gender={patient.gender} />
              <BloodTypeBadge bloodType={patient.bloodType} />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/${locale}/patients/${id}/edit`)}>
            <Pencil className="h-4 w-4 me-2" /> Edit
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() =>
              deleteMutation.mutate(id, {
                onSuccess: () => router.push(`/${locale}/patients`),
              })
            }
          >
            <Trash2 className="h-4 w-4 me-2" /> Delete
          </Button>
        </div>
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <Row label="Full Name" value={patient.name} />
          <Row label="Phone" value={patient.phone} />
          <Row label="Email" value={patient.email} />
          <Row label="Date of Birth" value={patient.dateOfBirth ? format(new Date(patient.dateOfBirth), "PPP") : null} />
          <Row label="National ID" value={patient.nationalId} />
          <Row label="Address" value={patient.address} />
        </CardContent>
      </Card>

      {/* Medical info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Medical Information</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <Row label="Gender" value={patient.gender} />
          <Row label="Blood Type" value={patient.bloodType} />
          <Row label="Allergies" value={patient.allergies} />
          <Row label="Medical Notes" value={patient.medicalNotes} />
        </CardContent>
      </Card>

      {/* Emergency contact */}
      <Card>
        <CardHeader><CardTitle className="text-base">Emergency Contact</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <Row label="Contact Name" value={patient.emergencyContactName} />
          <Row label="Contact Phone" value={patient.emergencyContactPhone} />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Created {format(new Date(patient.createdAt), "PPP")} ·
        Updated {format(new Date(patient.updatedAt), "PPP")}
      </p>
    </div>
  );
}
