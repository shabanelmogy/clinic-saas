"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import type { Patient, CreatePatientInput, UpdatePatientInput } from "../types/patient.types";

type Props = {
  defaultValues?: Partial<Patient>;
  onSubmit: (data: CreatePatientInput | UpdatePatientInput) => void;
  loading?: boolean;
  mode: "create" | "edit";
};

const GENDERS = ["male", "female", "other"] as const;
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export function PatientForm({ defaultValues, onSubmit, loading, mode }: Props) {
  const { register, handleSubmit, setValue, watch, reset } = useForm<CreatePatientInput>({
    defaultValues: {
      name: defaultValues?.name ?? "",
      phone: defaultValues?.phone ?? "",
      email: defaultValues?.email ?? "",
      dateOfBirth: defaultValues?.dateOfBirth ?? "",
      gender: defaultValues?.gender ?? undefined,
      bloodType: defaultValues?.bloodType ?? undefined,
      allergies: defaultValues?.allergies ?? "",
      medicalNotes: defaultValues?.medicalNotes ?? "",
      emergencyContactName: defaultValues?.emergencyContactName ?? "",
      emergencyContactPhone: defaultValues?.emergencyContactPhone ?? "",
      address: defaultValues?.address ?? "",
      nationalId: defaultValues?.nationalId ?? "",
    },
  });

  useEffect(() => {
    if (defaultValues) reset({ ...defaultValues } as CreatePatientInput);
  }, [defaultValues, reset]);

  const gender = watch("gender");
  const bloodType = watch("bloodType");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* Basic info */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Basic Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
            <Input id="name" {...register("name", { required: true })} placeholder="John Doe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register("phone")} placeholder="+1-555-0100" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} placeholder="patient@email.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of Birth</Label>
            <Input id="dateOfBirth" type="date" {...register("dateOfBirth")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nationalId">National ID</Label>
            <Input id="nationalId" {...register("nationalId")} placeholder="ID number" />
          </div>
        </div>
      </div>

      <Separator />

      {/* Medical info */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Medical Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Gender</Label>
            <Select value={gender} onValueChange={(v) => setValue("gender", v as typeof gender)}>
              <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Blood Type</Label>
            <Select value={bloodType} onValueChange={(v) => setValue("bloodType", v as typeof bloodType)}>
              <SelectTrigger><SelectValue placeholder="Select blood type" /></SelectTrigger>
              <SelectContent>
                {BLOOD_TYPES.map((bt) => (
                  <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="allergies">Allergies</Label>
            <Textarea id="allergies" {...register("allergies")} placeholder="Known allergies..." rows={2} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="medicalNotes">Medical Notes</Label>
            <Textarea id="medicalNotes" {...register("medicalNotes")} placeholder="Relevant medical history..." rows={3} />
          </div>
        </div>
      </div>

      <Separator />

      {/* Contact info */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Emergency Contact
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="emergencyContactName">Contact Name</Label>
            <Input id="emergencyContactName" {...register("emergencyContactName")} placeholder="Jane Doe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
            <Input id="emergencyContactPhone" {...register("emergencyContactPhone")} placeholder="+1-555-0200" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" {...register("address")} placeholder="Full address..." rows={2} />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
          {mode === "create" ? "Create Patient" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
