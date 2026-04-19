import { PatientsTable } from "@/features/patients/components/patients-table";

export default function PatientsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Patients</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Global patient registry — patients can book at any clinic.
        </p>
      </div>
      <PatientsTable />
    </div>
  );
}
