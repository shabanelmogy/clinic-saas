import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { clinicsApi } from "../api/clinics.api";
import type { UpdateClinicInput, ListClinicsParams } from "../types/clinic.types";

export const clinicKeys = {
  all:  () => ["clinics"] as const,
  list: (p?: ListClinicsParams) => ["clinics", "list", p] as const,
  me:   () => ["clinics", "me"] as const,
  detail: (id: string) => ["clinics", "detail", id] as const,
};

export function useClinics(params?: ListClinicsParams) {
  return useQuery({ queryKey: clinicKeys.list(params), queryFn: () => clinicsApi.list(params) });
}

export function useMyClinic() {
  return useQuery({ queryKey: clinicKeys.me(), queryFn: () => clinicsApi.getMe() });
}

export function useUpdateMyClinic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateClinicInput) => clinicsApi.updateMe(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: clinicKeys.me() }); toast.success("Clinic updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
