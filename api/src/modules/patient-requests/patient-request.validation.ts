import { z } from "zod";
import { paginationSchema } from "../../utils/shared-validators.js";
import { patientRequestStatusEnum } from "./patient-request.schema.js";
import { patientGenderEnum } from "../patients/patient.schema.js";
import type { TranslateFn } from "../../utils/i18n.js";

export const createPatientRequestSchemas = (t: TranslateFn) => ({
  /**
   * Public — no auth required.
   * clinicId is optional: patient may not know which clinic to register with.
   */
  create: z.object({
    name: z
      .string()
      .min(2, t("validation.minLength", { field: "Name", min: 2 }))
      .max(100, t("validation.maxLength", { field: "Name", max: 100 })),
    phone: z
      .string()
      .min(7, t("validation.minLength", { field: "Phone", min: 7 }))
      .max(20, t("validation.maxLength", { field: "Phone", max: 20 })),
    email: z.string().email(t("validation.invalidEmail")).optional(),
    dateOfBirth: z.string().date().optional(),
    gender: z.enum(patientGenderEnum.enumValues).optional(),
    clinicId: z.string().uuid(t("validation.invalidUuid")).optional(),
    preferredSlotId: z.string().uuid(t("validation.invalidUuid")).optional(),
    autoBook: z.boolean().default(false),
  }),

  /**
   * Staff — list with optional filters.
   * clinicId filter: super admin can filter by clinic; clinic staff always scoped by JWT.
   */
  listQuery: paginationSchema.extend({
    status: z.enum(patientRequestStatusEnum.enumValues).optional(),
    unassigned: z
      .string()
      .optional()
      .transform((v) => v === "true"),
  }),

  /**
   * Staff — assign a clinic to an unassigned request.
   */
  assignClinic: z.object({
    clinicId: z.string().uuid(t("validation.invalidUuid")),
  }),

  /**
   * Staff — override slot/autoBook at approval time (optional).
   */
  approve: z.object({
    preferredSlotId: z.string().uuid(t("validation.invalidUuid")).optional(),
    autoBook: z.boolean().optional(),
  }),

  reject: z.object({
    rejectionReason: z
      .string()
      .min(1, t("validation.required", { field: "Rejection reason" }))
      .max(500, t("validation.maxLength", { field: "Rejection reason", max: 500 })),
  }),
});

export const requestIdParamSchema = z.object({
  id: z.string().uuid("Invalid request ID"),
});

export type CreatePatientRequestInput = z.infer<
  ReturnType<typeof createPatientRequestSchemas>["create"]
>;
export type ListPatientRequestsQuery = z.infer<
  ReturnType<typeof createPatientRequestSchemas>["listQuery"]
>;
export type AssignClinicInput = z.infer<
  ReturnType<typeof createPatientRequestSchemas>["assignClinic"]
>;
export type ApprovePatientRequestInput = z.infer<
  ReturnType<typeof createPatientRequestSchemas>["approve"]
>;
export type RejectPatientRequestInput = z.infer<
  ReturnType<typeof createPatientRequestSchemas>["reject"]
>;
