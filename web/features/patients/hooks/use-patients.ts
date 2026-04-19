import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { patientsApi } from "../api/patients.api";
import type { CreatePatientInput, UpdatePatientInput, ListPatientsParams } from "../types/patient.types";

export const patientKeys = {
  all:    ()           => ["patients"] as const,
  list:   (p?: ListPatientsParams) => ["patients", "list", p] as const,
  detail: (id: string) => ["patients", "detail", id] as const,
};

// ─── List ─────────────────────────────────────────────────────────────────────

export function usePatients(params?: ListPatientsParams) {
  return useQuery({
    queryKey: patientKeys.list(params),
    queryFn: () => patientsApi.list(params),
  });
}

// ─── Single ───────────────────────────────────────────────────────────────────

export function usePatient(id: string) {
  return useQuery({
    queryKey: patientKeys.detail(id),
    queryFn: () => patientsApi.getById(id),
    enabled: !!id,
  });
}

// ─── Create ───────────────────────────────────────────────────────────────────

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePatientInput) => patientsApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.all() });
      toast.success("Patient created successfully");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Update ───────────────────────────────────────────────────────────────────

export function useUpdatePatient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePatientInput) => patientsApi.update(id, input),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: patientKeys.all() });
      qc.setQueryData(patientKeys.detail(id), updated);
      toast.success("Patient updated successfully");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function useDeletePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => patientsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.all() });
      toast.success("Patient deleted successfully");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
