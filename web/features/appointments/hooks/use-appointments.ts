import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { appointmentsApi } from "../api/appointments.api";
import type { CreateAppointmentInput, UpdateAppointmentInput, ListAppointmentsParams } from "../types/appointment.types";

export const appointmentKeys = {
  all:     () => ["appointments"] as const,
  list:    (p?: ListAppointmentsParams) => ["appointments", "list", p] as const,
  detail:  (id: string) => ["appointments", "detail", id] as const,
  history: (id: string) => ["appointments", "history", id] as const,
};

export function useAppointments(params?: ListAppointmentsParams) {
  return useQuery({
    queryKey: appointmentKeys.list(params),
    queryFn: () => appointmentsApi.list(params),
  });
}

export function useAppointment(id: string) {
  return useQuery({
    queryKey: appointmentKeys.detail(id),
    queryFn: () => appointmentsApi.getById(id),
    enabled: !!id,
  });
}

export function useAppointmentHistory(id: string) {
  return useQuery({
    queryKey: appointmentKeys.history(id),
    queryFn: () => appointmentsApi.getHistory(id),
    enabled: !!id,
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAppointmentInput) => appointmentsApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: appointmentKeys.all() });
      toast.success("Appointment created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateAppointment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAppointmentInput) => appointmentsApi.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: appointmentKeys.all() });
      toast.success("Appointment updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCancelAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      appointmentsApi.cancel(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: appointmentKeys.all() });
      toast.success("Appointment cancelled");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => appointmentsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: appointmentKeys.all() });
      toast.success("Appointment deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
