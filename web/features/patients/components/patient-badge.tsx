import { Badge } from "@/components/ui/badge";
import type { PatientGender, PatientBloodType } from "../types/patient.types";

export function GenderBadge({ gender }: { gender: PatientGender | null }) {
  if (!gender) return <span className="text-muted-foreground text-sm">—</span>;
  const map: Record<PatientGender, string> = {
    male:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    female: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
    other:  "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[gender]}`}>
      {gender.charAt(0).toUpperCase() + gender.slice(1)}
    </span>
  );
}

export function BloodTypeBadge({ bloodType }: { bloodType: PatientBloodType | null }) {
  if (!bloodType) return <span className="text-muted-foreground text-sm">—</span>;
  return (
    <Badge variant="outline" className="font-mono text-xs">
      {bloodType}
    </Badge>
  );
}

export function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive
    ? <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">Active</Badge>
    : <Badge variant="secondary" className="text-muted-foreground">Inactive</Badge>;
}
