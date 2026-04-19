import { z } from "zod";
import { paginationSchema } from "../../utils/shared-validators.js";
import { patientBloodTypeEnum, patientGenderEnum } from "./patient.schema.js";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export const createPatientSchemas = (t: TranslateFn) => ({
  create: z.object({
    name: z
      .string()
      .min(2, t("validation.minLength", { field: "Name", min: 2 }))
      .max(100, t("validation.maxLength", { field: "Name", max: 100 })),
    phone: z
      .string()
      .max(20, t("validation.maxLength", { field: "Phone", max: 20 }))
      .optional(),
    email: z.string().email(t("validation.invalidEmail")).optional(),
    dateOfBirth: z.string().date().optional(),
    gender: z.enum(patientGenderEnum.enumValues).optional(),
    bloodType: z.enum(patientBloodTypeEnum.enumValues).optional(),
    allergies: z
      .string()
      .max(2000, t("validation.maxLength", { field: "Allergies", max: 2000 }))
      .optional(),
    medicalNotes: z
      .string()
      .max(5000, t("validation.maxLength", { field: "Medical notes", max: 5000 }))
      .optional(),
    emergencyContactName: z
      .string()
      .max(100, t("validation.maxLength", { field: "Emergency contact name", max: 100 }))
      .optional(),
    emergencyContactPhone: z
      .string()
      .max(20, t("validation.maxLength", { field: "Emergency contact phone", max: 20 }))
      .optional(),
    address: z
      .string()
      .max(500, t("validation.maxLength", { field: "Address", max: 500 }))
      .optional(),
    nationalId: z
      .string()
      .max(50, t("validation.maxLength", { field: "National ID", max: 50 }))
      .optional(),
  }),

  update: z.object({
    name: z
      .string()
      .min(2, t("validation.minLength", { field: "Name", min: 2 }))
      .max(100, t("validation.maxLength", { field: "Name", max: 100 }))
      .optional(),
    phone: z.string().max(20, t("validation.maxLength", { field: "Phone", max: 20 })).optional(),
    email: z.string().email(t("validation.invalidEmail")).optional(),
    dateOfBirth: z.string().date().optional(),
    gender: z.enum(patientGenderEnum.enumValues).optional(),
    bloodType: z.enum(patientBloodTypeEnum.enumValues).optional(),
    allergies: z.string().max(2000, t("validation.maxLength", { field: "Allergies", max: 2000 })).optional(),
    medicalNotes: z.string().max(5000, t("validation.maxLength", { field: "Medical notes", max: 5000 })).optional(),
    emergencyContactName: z.string().max(100, t("validation.maxLength", { field: "Emergency contact name", max: 100 })).optional(),
    emergencyContactPhone: z.string().max(20, t("validation.maxLength", { field: "Emergency contact phone", max: 20 })).optional(),
    address: z.string().max(500, t("validation.maxLength", { field: "Address", max: 500 })).optional(),
    nationalId: z.string().max(50, t("validation.maxLength", { field: "National ID", max: 50 })).optional(),
    isActive: z.boolean().optional(),
  }),

  listQuery: paginationSchema.extend({
    search: z
      .string()
      .max(100, t("validation.maxLength", { field: "Search", max: 100 }))
      .optional(),
    isActive: z
      .string()
      .optional()
      .transform((v) => {
        if (v === "true") return true;
        if (v === "false") return false;
        return undefined;
      }),
    bloodType: z.enum(patientBloodTypeEnum.enumValues).optional(),
    gender: z.enum(patientGenderEnum.enumValues).optional(),
  }),
});

export type CreatePatientInput = z.infer<ReturnType<typeof createPatientSchemas>["create"]>;
export type UpdatePatientInput = z.infer<ReturnType<typeof createPatientSchemas>["update"]>;
export type ListPatientsQuery = z.infer<ReturnType<typeof createPatientSchemas>["listQuery"]>;
