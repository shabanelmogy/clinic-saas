export type DoctorSpecialty =
  | "general_practice" | "cardiology" | "dermatology" | "endocrinology"
  | "gastroenterology" | "gynecology" | "hematology" | "nephrology"
  | "neurology" | "oncology" | "ophthalmology" | "orthopedics"
  | "otolaryngology" | "pediatrics" | "psychiatry" | "pulmonology"
  | "radiology" | "rheumatology" | "surgery" | "urology" | "other";

export const SPECIALTIES: DoctorSpecialty[] = [
  "general_practice","cardiology","dermatology","endocrinology",
  "gastroenterology","gynecology","hematology","nephrology",
  "neurology","oncology","ophthalmology","orthopedics",
  "otolaryngology","pediatrics","psychiatry","pulmonology",
  "radiology","rheumatology","surgery","urology","other",
];

export type Doctor = {
  id: string;
  clinicId: string;
  staffUserId: string | null;
  name: string;
  specialty: DoctorSpecialty;
  bio: string | null;
  avatar: string | null;
  phone: string | null;
  email: string | null;
  experienceYears: number | null;
  consultationFee: number | null;
  isActive: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateDoctorInput = {
  name: string;
  specialty: DoctorSpecialty;
  staffUserId?: string;
  bio?: string;
  phone?: string;
  email?: string;
  experienceYears?: number;
  consultationFee?: number;
  isPublished?: boolean;
};

export type UpdateDoctorInput = Partial<CreateDoctorInput> & { isActive?: boolean };

export type DayOfWeek = "monday"|"tuesday"|"wednesday"|"thursday"|"friday"|"saturday"|"sunday";
export const DAYS_OF_WEEK: DayOfWeek[] = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];

export type DoctorSchedule = {
  id: string;
  clinicId: string;
  doctorId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  maxAppointments: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpsertScheduleInput = {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  slotDurationMinutes?: number;
  maxAppointments?: number;
  isActive?: boolean;
};
