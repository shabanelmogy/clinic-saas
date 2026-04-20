import { api } from "@/lib/api";
import type { ApiResponse } from "@/lib/api";
import type { Role, Permission, CreateRoleInput, UpdateRoleInput, AssignRoleInput, RoleAssignment } from "../types/rbac.types";

type Paginated<T> = { data: T[]; meta: { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean } };

export const rbacApi = {
  // ─── Roles ────────────────────────────────────────────────────────────────
  listRoles: async (params?: { page?: number; limit?: number; search?: string }): Promise<Paginated<Role>> => {
    const { data } = await api.get<ApiResponse<Role[]>>("/roles", { params });
    return { data: data.data, meta: data.meta! as Paginated<Role>["meta"] };
  },

  getRoleById: async (id: string): Promise<Role> => {
    const { data } = await api.get<ApiResponse<Role>>(`/roles/${id}`);
    return data.data;
  },

  createRole: async (input: CreateRoleInput): Promise<Role> => {
    const { data } = await api.post<ApiResponse<Role>>("/roles", input);
    return data.data;
  },

  updateRole: async (id: string, input: UpdateRoleInput): Promise<Role> => {
    const { data } = await api.patch<ApiResponse<Role>>(`/roles/${id}`, input);
    return data.data;
  },

  deleteRole: async (id: string): Promise<void> => {
    await api.delete(`/roles/${id}`);
  },

  // ─── Permissions ──────────────────────────────────────────────────────────
  listPermissions: async (): Promise<Permission[]> => {
    const { data } = await api.get<ApiResponse<Permission[]>>("/roles/permissions");
    return data.data;
  },

  // ─── Assignments ──────────────────────────────────────────────────────────
  assignRole: async (input: AssignRoleInput): Promise<void> => {
    await api.post("/roles/assign", input);
  },

  unassignRole: async (input: AssignRoleInput): Promise<void> => {
    await api.post("/roles/unassign", input);
  },

  listAssignments: async (params?: { page?: number; limit?: number; staffUserId?: string }): Promise<Paginated<RoleAssignment>> => {
    const { data } = await api.get<ApiResponse<RoleAssignment[]>>("/roles/assignments", { params });
    return { data: data.data, meta: data.meta! as Paginated<RoleAssignment>["meta"] };
  },
};
