import { api } from "@/lib/api";
import type { ApiResponse } from "@/lib/api";
import type { StaffUserRecord, CreateStaffUserInput, UpdateStaffUserInput, ListStaffUsersParams } from "../types/staff-user.types";

type Paginated<T> = { data: T[]; meta: { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean } };

export const staffUsersApi = {
  list: async (params?: ListStaffUsersParams): Promise<Paginated<StaffUserRecord>> => {
    const { data } = await api.get<ApiResponse<StaffUserRecord[]>>("/staff-users", { params });
    return { data: data.data, meta: data.meta! as Paginated<StaffUserRecord>["meta"] };
  },
  getById: async (id: string): Promise<StaffUserRecord> => {
    const { data } = await api.get<ApiResponse<StaffUserRecord>>(`/staff-users/${id}`);
    return data.data;
  },
  create: async (input: CreateStaffUserInput): Promise<StaffUserRecord> => {
    const { data } = await api.post<ApiResponse<StaffUserRecord>>("/staff-users", input);
    return data.data;
  },
  update: async (id: string, input: UpdateStaffUserInput): Promise<StaffUserRecord> => {
    const { data } = await api.patch<ApiResponse<StaffUserRecord>>(`/staff-users/${id}`, input);
    return data.data;
  },
  delete: async (id: string): Promise<void> => { await api.delete(`/staff-users/${id}`); },
};
