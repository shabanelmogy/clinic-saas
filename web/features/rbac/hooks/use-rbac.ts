import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { rbacApi } from "../api/rbac.api";
import type { CreateRoleInput, UpdateRoleInput, AssignRoleInput } from "../types/rbac.types";

export const rbacKeys = {
  roles:       () => ["roles"] as const,
  rolesList:   (p?: object) => ["roles", "list", p] as const,
  roleDetail:  (id: string) => ["roles", "detail", id] as const,
  permissions: () => ["roles", "permissions"] as const,
};

export function useRoles(params?: { page?: number; limit?: number; search?: string }) {
  return useQuery({ queryKey: rbacKeys.rolesList(params), queryFn: () => rbacApi.listRoles(params) });
}

export function useRole(id: string) {
  return useQuery({ queryKey: rbacKeys.roleDetail(id), queryFn: () => rbacApi.getRoleById(id), enabled: !!id });
}

export function usePermissions() {
  return useQuery({ queryKey: rbacKeys.permissions(), queryFn: () => rbacApi.listPermissions(), staleTime: Infinity });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoleInput) => rbacApi.createRole(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: rbacKeys.roles() }); toast.success("Role created"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateRole(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateRoleInput) => rbacApi.updateRole(id, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: rbacKeys.roles() }); toast.success("Role updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rbacApi.deleteRole(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: rbacKeys.roles() }); toast.success("Role deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAssignRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignRoleInput) => rbacApi.assignRole(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: rbacKeys.roles() }); toast.success("Role assigned"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUnassignRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignRoleInput) => rbacApi.unassignRole(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: rbacKeys.roles() }); toast.success("Role removed"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
