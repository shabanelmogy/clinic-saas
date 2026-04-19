// ─── Enums ────────────────────────────────────────────────────────────────────

export type PatientGender = "male" | "female" | "other";
export type PatientBloodType = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

// ─── Entity ───────────────────────────────────────────────────────────────────

export type Patient = {
  id: string;
  // clinicId removed — patients are global, not clinic-owned
  name: string;
  phone: string | null;
  email: string | null;
  dateOfBirth: string | null;
  gender: PatientGender | null;
  bloodType: PatientBloodType | null;
  allergies: string | null;
  medicalNotes: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  address: string | null;
  nationalId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

// ─── API payloads ─────────────────────────────────────────────────────────────

export type CreatePatientInput = {
  name: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: PatientGender;
  bloodType?: PatientBloodType;
  allergies?: string;
  medicalNotes?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  address?: string;
  nationalId?: string;
};

export type UpdatePatientInput = Partial<CreatePatientInput> & {
  isActive?: boolean;
};

export type ListPatientsParams = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  gender?: PatientGender;
  bloodType?: PatientBloodType;
};
