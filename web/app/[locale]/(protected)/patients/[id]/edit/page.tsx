"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PatientForm } from "@/features/patients/components/patient-form";
import { usePatient, useUpdatePatient } from "@/features/patients/hooks/use-patients";

export default function EditPatientPage() {
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const router = useRouter();
  const { data: patient, isLoading } = usePatient(id);
  const updateMutation = useUpdatePatient(id);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Edit Patient</h1>
          <p className="text-sm text-muted-foreground">{patient?.name}</p>
        </div>
      </div>

      <PatientForm
        mode="edit"
        defaultValues={patient}
        loading={updateMutation.isPending}
        onSubmit={(data) =>
          updateMutation.mutate(data, {
            onSuccess: () => router.push(`/${locale}/patients/${id}`),
          })
        }
      />
    </div>
  );
}
