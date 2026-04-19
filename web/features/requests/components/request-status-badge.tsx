import { Badge } from "@/components/ui/badge";
import type { PatientRequestStatus, DoctorRequestStatus } from "../types/request.types";

type Status = PatientRequestStatus | DoctorRequestStatus;

const MAP: Record<Status, { label: string; className: string }> = {
  pending:  { label: "Pending",  className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-0" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0" },
};

export function RequestStatusBadge({ status }: { status: Status }) {
  const { label, className } = MAP[status] ?? MAP.pending;
  return <Badge className={className}>{label}</Badge>;
}
