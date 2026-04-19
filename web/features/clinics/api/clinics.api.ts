import { api } from "@/lib/api";
import type { ApiResponse } from "@/lib/api";
import type { Clinic, UpdateClinicInput, ListClinicsParams } from "../types/clinic.types";

type Paginated<T> = { data: T[]; meta: { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean } };

export const clinicsApi = {
  list: async (params?: ListClinicsParams): Promise<Paginated<Clinic>> => {
    const { data } = await api.get<ApiResponse<Clinic[]>>("/clinics", { params });
    return { data: data.data, meta: data.meta! as Paginated<Clinic>["meta"] };
  },
  getById: async (id: string): Promise<Clinic> => {
    const { data } = await api.get<ApiResponse<Clinic>>(`/clinics/${id}`);
    return data.data;
  },
  getMe: async (): Promise<Clinic> => {
    const { data } = await api.get<ApiResponse<Clinic>>("/clinics/me");
    return data.data;
  },
  updateMe: async (input: UpdateClinicInput): Promise<Clinic> => {
    const { data } = await api.patch<ApiResponse<Clinic>>("/clinics/me", input);
    return data.data;
  },
};
