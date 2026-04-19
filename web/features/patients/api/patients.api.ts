import { api } from "@/lib/api";
import type { ApiResponse } from "@/lib/api";
import type {
  Patient,
  CreatePatientInput,
  UpdatePatientInput,
  ListPatientsParams,
} from "../types/patient.types";

type PaginatedPatients = {
  data: Patient[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

export const patientsApi = {
  list: async (params?: ListPatientsParams): Promise<PaginatedPatients> => {
    const { data } = await api.get<ApiResponse<Patient[]>>("/patients", { params });
    return { data: data.data, meta: data.meta! as PaginatedPatients["meta"] };
  },

  getById: async (id: string): Promise<Patient> => {
    const { data } = await api.get<ApiResponse<Patient>>(`/patients/${id}`);
    return data.data;
  },

  create: async (input: CreatePatientInput): Promise<Patient> => {
    const { data } = await api.post<ApiResponse<Patient>>("/patients", input);
    return data.data;
  },

  update: async (id: string, input: UpdatePatientInput): Promise<Patient> => {
    const { data } = await api.patch<ApiResponse<Patient>>(`/patients/${id}`, input);
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/patients/${id}`);
  },
};
