"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useDoctor, useUpdateDoctor } from "@/features/doctors/hooks/use-doctors";
import { SPECIALTIES } from "@/features/doctors/types/doctor.types";
import type { UpdateDoctorInput, DoctorSpecialty } from "@/features/doctors/types/doctor.types";

export default function EditDoctorPage() {
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const router = useRouter();
  const { data: doctor, isLoading } = useDoctor(id);
  const updateMutation = useUpdateDoctor(id);

  const { register, handleSubmit, reset, control } = useForm<UpdateDoctorInput>();

  useEffect(() => {
    if (doctor) reset({
      name: doctor.name,
      specialty: doctor.specialty,
      bio: doctor.bio ?? "",
      phone: doctor.phone ?? "",
      email: doctor.email ?? "",
      experienceYears: doctor.experienceYears ?? undefined,
      consultationFee: doctor.consultationFee ?? undefined,
      isActive: doctor.isActive,
      isPublished: doctor.isPublished,
    });
  }, [doctor, reset]);

  if (isLoading) return <div className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold">Edit Doctor</h1>
          <p className="text-sm text-muted-foreground">{doctor?.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data, { onSuccess: () => router.push(`/${locale}/doctors/${id}`) }))} className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Info</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Full Name *</Label>
              <Input {...register("name", { required: true })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Specialty *</Label>
              <Controller control={control} name="specialty" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SPECIALTIES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-2"><Label>Phone</Label><Input {...register("phone")} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" {...register("email")} /></div>
            <div className="space-y-2"><Label>Experience (years)</Label><Input type="number" min={0} max={70} {...register("experienceYears", { valueAsNumber: true })} /></div>
            <div className="space-y-2"><Label>Consultation Fee (cents)</Label><Input type="number" min={0} {...register("consultationFee", { valueAsNumber: true })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Bio</Label><Textarea rows={3} {...register("bio")} /></div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Visibility</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Controller control={control} name="isActive" render={({ field }) => (
                <Select value={String(field.value)} onValueChange={v => field.onChange(v === "true")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-2">
              <Label>Published</Label>
              <Controller control={control} name="isPublished" render={({ field }) => (
                <Select value={String(field.value)} onValueChange={v => field.onChange(v === "true")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Published</SelectItem>
                    <SelectItem value="false">Draft</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />} Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
