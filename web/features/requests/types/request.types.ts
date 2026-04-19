// ─── Patient Requests ─────────────────────────────────────────────────────────

export type PatientRequestStatus = "pending" | "approved" | "rejected";

export type PatientRequest = {
  id: string;
  clinicId: string | null;
  name: string;
  phone: string;
  email: string | null;
  dateOfBirth: string | null;
  gender: "male" | "female" | "other" | null;
  preferredSlotId: string | null;
  autoBook: boolean;
  status: PatientRequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListPatientRequestsParams = {
  page?: number; limit?: number;
  status?: PatientRequestStatus;
  unassigned?: boolean;
};

// ─── Doctor Requests ──────────────────────────────────────────────────────────

export type DoctorRequestType   = "join" | "create";
export type DoctorRequestStatus = "pending" | "approved" | "rejected";

export type DoctorRequest = {
  id: string;
  type: DoctorRequestType;
  clinicId: string | null;
  name: string;
  phone: string;
  email: string;
  specialty: string;
  experienceYears: number | null;
  clinicName: string | null;
  clinicAddress: string | null;
  status: DoctorRequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListDoctorRequestsParams = {
  page?: number; limit?: number;
  status?: DoctorRequestStatus;
  type?: DoctorRequestType;
};
