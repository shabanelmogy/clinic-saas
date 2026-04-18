import { z } from "zod";
import { paginationSchema } from "../../utils/shared-validators.js";
import { appointmentStatusEnum } from "./appointment.schema.js";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export const createAppointmentSchemas = (t: TranslateFn) => ({
  /**
   * Patient creates appointment — must supply clinicId (which clinic to book with).
   * Staff creates appointment — clinicId comes from JWT, must supply patientId.
   * Both fields are optional here; the service enforces the correct one per userType.
   */
  create: z.object({
    // Required when a STAFF member creates on behalf of a patient
    patientId: z.string().uuid(t("validation.invalidUuid")).optional(),
    // Required when a PATIENT books — which clinic to book with
    clinicId: z.string().uuid(t("validation.invalidUuid")).optional(),
    title: z
      .string()
      .min(2, t("validation.minLength", { field: "Title", min: 2 }))
      .max(200, t("validation.maxLength", { field: "Title", max: 200 })),
    description: z
      .string()
      .max(1000, t("validation.maxLength", { field: "Description", max: 1000 }))
      .optional(),
    scheduledAt: z
      .string()
      .datetime({ message: t("validation.appointments.invalidDatetime") })
      .refine((val: string) => new Date(val) > new Date(), {
        message: t("validation.appointments.mustBeFuture"),
      }),
    durationMinutes: z.coerce
      .number()
      .int(t("validation.appointments.durationMustBeInteger"))
      .min(5, t("validation.min", { field: "Duration", min: 5 }))
      .max(480, t("validation.max", { field: "Duration", max: 480 }))
      .default(60),
    notes: z
      .string()
      .max(2000, t("validation.maxLength", { field: "Notes", max: 2000 }))
      .optional(),
  }),

  update: z.object({
    title: z
      .string()
      .min(2, t("validation.minLength", { field: "Title", min: 2 }))
      .max(200, t("validation.maxLength", { field: "Title", max: 200 }))
      .optional(),
    description: z
      .string()
      .max(1000, t("validation.maxLength", { field: "Description", max: 1000 }))
      .optional(),
    scheduledAt: z
      .string()
      .datetime({ message: t("validation.appointments.invalidDatetime") })
      .refine((val: string) => new Date(val) > new Date(), {
        message: t("validation.appointments.mustBeFuture"),
      })
      .optional(),
    durationMinutes: z.coerce
      .number()
      .int(t("validation.appointments.durationMustBeInteger"))
      .min(5, t("validation.min", { field: "Duration", min: 5 }))
      .max(480, t("validation.max", { field: "Duration", max: 480 }))
      .optional(),
    status: z.enum(appointmentStatusEnum.enumValues).optional(),
    notes: z
      .string()
      .max(2000, t("validation.maxLength", { field: "Notes", max: 2000 }))
      .optional(),
  }),

  listQuery: paginationSchema.extend({
    // Staff can filter by patientId within their clinic
    patientId: z.string().uuid(t("validation.invalidUuid")).optional(),
    status: z.enum(appointmentStatusEnum.enumValues).optional(),
    from: z
      .string()
      .datetime({ message: t("validation.appointments.invalidDatetime") })
      .optional(),
    to: z
      .string()
      .datetime({ message: t("validation.appointments.invalidDatetime") })
      .optional(),
  }),
});

export type CreateAppointmentInput = z.infer<ReturnType<typeof createAppointmentSchemas>["create"]>;
export type UpdateAppointmentInput = z.infer<ReturnType<typeof createAppointmentSchemas>["update"]>;
export type ListAppointmentsQuery = z.infer<ReturnType<typeof createAppointmentSchemas>["listQuery"]>;
