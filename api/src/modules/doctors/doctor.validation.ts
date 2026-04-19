import { z } from "zod";
import { paginationSchema } from "../../utils/shared-validators.js";
import { doctorSpecialtyEnum } from "./doctor.schema.js";
import type { TranslateFn } from "../../utils/i18n.js";

export const createDoctorSchemas = (t: TranslateFn) => ({
  create: z.object({
    staffUserId: z.string().uuid(t("validation.invalidUuid")).optional(),
    name: z
      .string()
      .min(2, t("validation.minLength", { field: "Name", min: 2 }))
      .max(100, t("validation.maxLength", { field: "Name", max: 100 })),
    specialty: z.enum(doctorSpecialtyEnum.enumValues),
    bio: z.string().max(2000, t("validation.maxLength", { field: "Bio", max: 2000 })).optional(),
    avatar: z.string().url(t("validation.clinics.invalidUrl")).optional(),
    phone: z.string().max(20, t("validation.maxLength", { field: "Phone", max: 20 })).optional(),
    email: z.string().email(t("validation.invalidEmail")).optional(),
    experienceYears: z.coerce
      .number()
      .int()
      .min(0, t("validation.min", { field: "Experience years", min: 0 }))
      .max(70, t("validation.max", { field: "Experience years", max: 70 }))
      .optional(),
    consultationFee: z.coerce
      .number()
      .int()
      .min(0, t("validation.min", { field: "Consultation fee", min: 0 }))
      .optional(),
    isPublished: z.boolean().default(true),
  }),

  update: z.object({
    name: z.string().min(2, t("validation.minLength", { field: "Name", min: 2 })).max(100, t("validation.maxLength", { field: "Name", max: 100 })).optional(),
    specialty: z.enum(doctorSpecialtyEnum.enumValues).optional(),
    bio: z.string().max(2000, t("validation.maxLength", { field: "Bio", max: 2000 })).optional(),
    avatar: z.string().url(t("validation.clinics.invalidUrl")).optional(),
    phone: z.string().max(20, t("validation.maxLength", { field: "Phone", max: 20 })).optional(),
    email: z.string().email(t("validation.invalidEmail")).optional(),
    experienceYears: z.coerce.number().int().min(0).max(70).optional(),
    consultationFee: z.coerce.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    isPublished: z.boolean().optional(),
  }),

  listQuery: paginationSchema.extend({
    specialty: z.enum(doctorSpecialtyEnum.enumValues).optional(),
    search: z.string().max(100, t("validation.maxLength", { field: "Search", max: 100 })).optional(),
  }),
});

export type CreateDoctorInput = z.infer<ReturnType<typeof createDoctorSchemas>["create"]>;
export type UpdateDoctorInput = z.infer<ReturnType<typeof createDoctorSchemas>["update"]>;
export type ListDoctorsQuery = z.infer<ReturnType<typeof createDoctorSchemas>["listQuery"]>;
