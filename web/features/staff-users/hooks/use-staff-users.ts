import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { staffUsersApi } from "../api/staff-users.api";
import type { CreateStaffUserInput, UpdateStaffUserInput, ListStaffUsersParams } from "../types/staff-user.types";

export const staffUserKeys = {
  all:    () => ["staff-users"] as const,
  list:   (p?: ListStaffUsersParams) => ["staff-users", "list", p] as const,
  detail: (id: string) => ["staff-users", "detail", id] as const,
};

export function useStaffUsers(params?: ListStaffUsersParams) {
  return useQuery({ queryKey: staffUserKeys.list(params), queryFn: () => staffUsersApi.list(params) });
}

export function useStaffUser(id: string) {
  return useQuery({ queryKey: staffUserKeys.detail(id), queryFn: () => staffUsersApi.getById(id), enabled: !!id });
}

export function useCreateStaffUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStaffUserInput) => staffUsersApi.create(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: staffUserKeys.all() }); toast.success("Staff user created"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateStaffUser(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateStaffUserInput) => staffUsersApi.update(id, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: staffUserKeys.all() }); toast.success("Staff user updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteStaffUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => staffUsersApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: staffUserKeys.all() }); toast.success("Staff user deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
