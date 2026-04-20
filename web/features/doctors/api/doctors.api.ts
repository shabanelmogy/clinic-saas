import { api } from "@/lib/api";
import type { ApiResponse } from "@/lib/api";
import type { Doctor, CreateDoctorInput, UpdateDoctorInput, DoctorSchedule, UpsertScheduleInput, DayOfWeek } from "../types/doctor.types";

type Paginated<T> = { data: T[]; meta: { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean } };

export const doctorsApi = {
  list: async (params?: { page?: number; limit?: number; search?: string; specialty?: string }): Promise<Paginated<Doctor>> => {
    const { data } = await api.get<ApiResponse<Doctor[]>>("/doctors", { params });
    return { data: data.data, meta: data.meta! as Paginated<Doctor>["meta"] };
  },
  getById: async (id: string): Promise<Doctor> => {
    const { data } = await api.get<ApiResponse<Doctor>>(`/doctors/${id}`);
    return data.data;
  },
  create: async (input: CreateDoctorInput): Promise<Doctor> => {
    const { data } = await api.post<ApiResponse<Doctor>>("/doctors", input);
    return data.data;
  },
  update: async (id: string, input: UpdateDoctorInput): Promise<Doctor> => {
    const { data } = await api.patch<ApiResponse<Doctor>>(`/doctors/${id}`, input);
    return data.data;
  },
  delete: async (id: string): Promise<void> => { await api.delete(`/doctors/${id}`); },

  // ─── Schedules ─────────────────────────────────────────────────────────────
  getSchedules: async (doctorId: string): Promise<DoctorSchedule[]> => {
    const { data } = await api.get<ApiResponse<DoctorSchedule[]>>(`/doctors/${doctorId}/schedules`);
    return data.data;
  },
  upsertSchedule: async (doctorId: string, input: UpsertScheduleInput): Promise<DoctorSchedule> => {
    const { data } = await api.put<ApiResponse<DoctorSchedule>>(`/doctors/${doctorId}/schedules`, input);
    return data.data;
  },
  deleteSchedule: async (doctorId: string, day: DayOfWeek): Promise<void> => {
    await api.delete(`/doctors/${doctorId}/schedules/${day}`);
  },

  // ─── Slot generation ───────────────────────────────────────────────────────
  generateSlots: async (doctorId: string, from: string, to: string): Promise<{ generated: number; attempted: number }> => {
    const { data } = await api.post<ApiResponse<{ generated: number; attempted: number }>>("/slot-times/generate", { doctorId, from, to });
    return data.data;
  },
};
