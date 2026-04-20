export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";

export type Appointment = {
  id: string;
  clinicId: string;
  patientId: string;
  doctorId: string | null;
  slotId: string | null;
  title: string;
  description: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

// Enriched appointment includes resolved names from joined tables
export type AppointmentEnriched = Appointment & {
  patientName: string | null;
  doctorName: string | null;
};

export type AppointmentHistoryEntry = {
  id: string;
  appointmentId: string;
  clinicId: string;
  previousStatus: AppointmentStatus | null;
  newStatus: AppointmentStatus;
  changedBy: string | null;
  reason: string | null;
  changedAt: string;
};

export type CreateAppointmentInput = {
  patientId?: string;
  clinicId?: string;
  slotId?: string;
  title: string;
  description?: string;
  scheduledAt: string;
  durationMinutes?: number;
  notes?: string;
};

export type UpdateAppointmentInput = {
  title?: string;
  description?: string;
  scheduledAt?: string;
  durationMinutes?: number;
  status?: AppointmentStatus;
  notes?: string;
};

export type ListAppointmentsParams = {
  page?: number;
  limit?: number;
  patientId?: string;
  status?: AppointmentStatus;
  from?: string;
  to?: string;
};
