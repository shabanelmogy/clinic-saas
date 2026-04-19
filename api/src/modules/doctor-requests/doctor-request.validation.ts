import { z } from "zod";
import { paginationSchema } from "../../utils/shared-validators.js";
import { doctorRequestTypeEnum, doctorRequestStatusEnum } from "./doctor-request.schema.js";
import { doctorSpecialtyEnum } from "../doctors/doctor.schema.js";
import type { TranslateFn } from "../../utils/i18n.js";

export const createDoctorRequestSchemas = (t: TranslateFn) => {
  // ── Shared doctor fields ────────────────────────────────────────────────
  const doctorFields = {
    name: z
      .string()
      .min(2, t("validation.minLength", { field: "Name", min: 2 }))
      .max(100, t("validation.maxLength", { field: "Name", max: 100 })),
    phone: z
      .string()
      .min(7, t("validation.minLength", { field: "Phone", min: 7 }))
      .max(20, t("validation.maxLength", { field: "Phone", max: 20 })),
    email: z.string().email(t("validation.invalidEmail")),
    specialty: z.enum(doctorSpecialtyEnum.enumValues),
    experienceYears: z.coerce
      .number()
      .int()
      .min(0, t("validation.min", { field: "Experience years", min: 0 }))
      .max(70, t("validation.max", { field: "Experience years", max: 70 }))
      .optional(),
  };

  return {
    /**
     * Public — no auth required.
     *
     * Discriminated union:
     *   type = "join"   → clinicId required
     *   type = "create" → clinicName required
     */
    create: z
      .discriminatedUnion("type", [
        z.object({
          type: z.literal("join"),
          clinicId: z.string().uuid(t("validation.invalidUuid")),
          ...doctorFields,
        }),
        z.object({
          type: z.literal("create"),
          clinicName: z
            .string()
            .min(2, t("validation.minLength", { field: "Clinic name", min: 2 }))
            .max(200, t("validation.maxLength", { field: "Clinic name", max: 200 })),
          clinicAddress: z
            .string()
            .max(500, t("validation.maxLength", { field: "Clinic address", max: 500 }))
            .optional(),
          ...doctorFields,
        }),
      ]),

    listQuery: paginationSchema.extend({
      status: z.enum(doctorRequestStatusEnum.enumValues).optional(),
      type: z.enum(doctorRequestTypeEnum.enumValues).optional(),
    }),

    reject: z.object({
      rejectionReason: z
        .string()
        .min(1, t("validation.required", { field: "Rejection reason" }))
        .max(500, t("validation.maxLength", { field: "Rejection reason", max: 500 })),
    }),
  };
};

export const requestIdParamSchema = z.object({
  id: z.string().uuid("Invalid request ID"),
});

export type CreateDoctorRequestInput = z.infer<
  ReturnType<typeof createDoctorRequestSchemas>["create"]
>;
export type ListDoctorRequestsQuery = z.infer<
  ReturnType<typeof createDoctorRequestSchemas>["listQuery"]
>;
export type RejectDoctorRequestInput = z.infer<
  ReturnType<typeof createDoctorRequestSchemas>["reject"]
>;
