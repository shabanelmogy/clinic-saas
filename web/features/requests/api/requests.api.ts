import { api } from "@/lib/api";
import type { ApiResponse } from "@/lib/api";
import type {
  PatientRequest, ListPatientRequestsParams,
  DoctorRequest, ListDoctorRequestsParams,
} from "../types/request.types";

type Paginated<T> = { data: T[]; meta: { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean } };

// ─── Patient Requests ─────────────────────────────────────────────────────────

export const patientRequestsApi = {
  list: async (params?: ListPatientRequestsParams): Promise<Paginated<PatientRequest>> => {
    const { data } = await api.get<ApiResponse<PatientRequest[]>>("/patient-requests", { params });
    return { data: data.data, meta: data.meta! as Paginated<PatientRequest>["meta"] };
  },
  assignClinic: async (id: string, clinicId: string): Promise<PatientRequest> => {
    const { data } = await api.patch<ApiResponse<PatientRequest>>(`/patient-requests/${id}/assign-clinic`, { clinicId });
    return data.data;
  },
  approve: async (id: string): Promise<{ request: PatientRequest; patientId: string; warning: string | null }> => {
    const { data } = await api.post<ApiResponse<{ request: PatientRequest; patientId: string; warning: string | null }>>(`/patient-requests/${id}/approve`);
    return data.data;
  },
  reject: async (id: string, rejectionReason: string): Promise<PatientRequest> => {
    const { data } = await api.post<ApiResponse<PatientRequest>>(`/patient-requests/${id}/reject`, { rejectionReason });
    return data.data;
  },
};

// ─── Doctor Requests ──────────────────────────────────────────────────────────

export const doctorRequestsApi = {
  list: async (params?: ListDoctorRequestsParams): Promise<Paginated<DoctorRequest>> => {
    const { data } = await api.get<ApiResponse<DoctorRequest[]>>("/doctor-requests", { params });
    return { data: data.data, meta: data.meta! as Paginated<DoctorRequest>["meta"] };
  },
  approve: async (id: string): Promise<DoctorRequest> => {
    const { data } = await api.post<ApiResponse<{ request: DoctorRequest }>>(`/doctor-requests/${id}/approve`);
    return data.data.request;
  },
  reject: async (id: string, rejectionReason: string): Promise<DoctorRequest> => {
    const { data } = await api.post<ApiResponse<DoctorRequest>>(`/doctor-requests/${id}/reject`, { rejectionReason });
    return data.data;
  },
};
