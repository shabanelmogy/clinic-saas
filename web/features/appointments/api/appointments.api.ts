import { api } from "@/lib/api";
import type { ApiResponse } from "@/lib/api";
import type {
  Appointment,
  AppointmentEnriched,
  AppointmentHistoryEntry,
  CreateAppointmentInput,
  UpdateAppointmentInput,
  ListAppointmentsParams,
} from "../types/appointment.types";

type Paginated<T> = {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

export const appointmentsApi = {
  // ── Enriched endpoints (with patient + doctor names) ──────────────────────

  list: async (params?: ListAppointmentsParams): Promise<Paginated<AppointmentEnriched>> => {
    const { data } = await api.get<ApiResponse<AppointmentEnriched[]>>("/appointments/enriched", { params });
    return { data: data.data, meta: data.meta! as Paginated<AppointmentEnriched>["meta"] };
  },

  getById: async (id: string): Promise<AppointmentEnriched> => {
    const { data } = await api.get<ApiResponse<AppointmentEnriched>>(`/appointments/${id}/enriched`);
    return data.data;
  },

  // ── History ───────────────────────────────────────────────────────────────

  getHistory: async (id: string): Promise<AppointmentHistoryEntry[]> => {
    const { data } = await api.get<ApiResponse<AppointmentHistoryEntry[]>>(`/appointments/${id}/history`);
    return data.data;
  },

  // ── Mutations ─────────────────────────────────────────────────────────────

  create: async (input: CreateAppointmentInput): Promise<Appointment> => {
    const { data } = await api.post<ApiResponse<Appointment>>("/appointments", input);
    return data.data;
  },

  update: async (id: string, input: UpdateAppointmentInput): Promise<Appointment> => {
    const { data } = await api.patch<ApiResponse<Appointment>>(`/appointments/${id}`, input);
    return data.data;
  },

  cancel: async (id: string, reason?: string): Promise<Appointment> => {
    const { data } = await api.post<ApiResponse<Appointment>>(`/appointments/${id}/cancel`, { reason });
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/appointments/${id}`);
  },
};
