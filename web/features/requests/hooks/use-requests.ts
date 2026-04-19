import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { patientRequestsApi, doctorRequestsApi } from "../api/requests.api";
import type { ListPatientRequestsParams, ListDoctorRequestsParams } from "../types/request.types";

// ─── Patient Requests ─────────────────────────────────────────────────────────

export const patientRequestKeys = {
  all:  () => ["patient-requests"] as const,
  list: (p?: ListPatientRequestsParams) => ["patient-requests", "list", p] as const,
};

export function usePatientRequests(params?: ListPatientRequestsParams) {
  return useQuery({ queryKey: patientRequestKeys.list(params), queryFn: () => patientRequestsApi.list(params) });
}

export function useApprovePatientRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => patientRequestsApi.approve(id),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: patientRequestKeys.all() });
      const msg = result.warning ? `Approved. ${result.warning}` : "Patient request approved";
      toast.success(msg);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRejectPatientRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => patientRequestsApi.reject(id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: patientRequestKeys.all() }); toast.success("Request rejected"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAssignClinicToRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, clinicId }: { id: string; clinicId: string }) => patientRequestsApi.assignClinic(id, clinicId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: patientRequestKeys.all() }); toast.success("Clinic assigned"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Doctor Requests ──────────────────────────────────────────────────────────

export const doctorRequestKeys = {
  all:  () => ["doctor-requests"] as const,
  list: (p?: ListDoctorRequestsParams) => ["doctor-requests", "list", p] as const,
};

export function useDoctorRequests(params?: ListDoctorRequestsParams) {
  return useQuery({ queryKey: doctorRequestKeys.list(params), queryFn: () => doctorRequestsApi.list(params) });
}

export function useApproveDoctorRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => doctorRequestsApi.approve(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: doctorRequestKeys.all() }); toast.success("Doctor request approved"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRejectDoctorRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => doctorRequestsApi.reject(id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: doctorRequestKeys.all() }); toast.success("Request rejected"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
