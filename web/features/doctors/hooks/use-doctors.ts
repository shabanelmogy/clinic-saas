import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { doctorsApi } from "../api/doctors.api";
import type { CreateDoctorInput, UpdateDoctorInput, UpsertScheduleInput, DayOfWeek } from "../types/doctor.types";

export const doctorKeys = {
  all:       () => ["doctors"] as const,
  list:      (p?: object) => ["doctors", "list", p] as const,
  detail:    (id: string) => ["doctors", "detail", id] as const,
  schedules: (id: string) => ["doctors", "schedules", id] as const,
};

export function useDoctors(params?: { page?: number; limit?: number; search?: string; specialty?: string }) {
  return useQuery({ queryKey: doctorKeys.list(params), queryFn: () => doctorsApi.list(params) });
}

export function useDoctor(id: string) {
  return useQuery({ queryKey: doctorKeys.detail(id), queryFn: () => doctorsApi.getById(id), enabled: !!id });
}

export function useDoctorSchedules(doctorId: string) {
  return useQuery({ queryKey: doctorKeys.schedules(doctorId), queryFn: () => doctorsApi.getSchedules(doctorId), enabled: !!doctorId });
}

export function useCreateDoctor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDoctorInput) => doctorsApi.create(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: doctorKeys.all() }); toast.success("Doctor created"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateDoctor(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateDoctorInput) => doctorsApi.update(id, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: doctorKeys.all() }); toast.success("Doctor updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteDoctor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => doctorsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: doctorKeys.all() }); toast.success("Doctor deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpsertSchedule(doctorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertScheduleInput) => doctorsApi.upsertSchedule(doctorId, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: doctorKeys.schedules(doctorId) }); toast.success("Schedule saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSchedule(doctorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (day: DayOfWeek) => doctorsApi.deleteSchedule(doctorId, day),
    onSuccess: () => { qc.invalidateQueries({ queryKey: doctorKeys.schedules(doctorId) }); toast.success("Schedule removed"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGenerateSlots() {
  return useMutation({
    mutationFn: ({ doctorId, from, to }: { doctorId: string; from: string; to: string }) =>
      doctorsApi.generateSlots(doctorId, from, to),
    onSuccess: (r) => toast.success(`Generated ${r.generated} slots`),
    onError: (e: Error) => toast.error(e.message),
  });
}
