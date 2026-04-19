import { z } from "zod";
import { paginationSchema } from "../../utils/shared-validators.js";
import { slotStatusEnum } from "./slot-time.schema.js";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export const createSlotTimeSchemas = (t: TranslateFn) => ({
  // Query available slots — public and staff
  listQuery: paginationSchema.extend({
    doctorId: z.string().uuid(t("validation.invalidUuid")).optional(),
    status: z.enum(slotStatusEnum.enumValues).optional(),
    from: z
      .string()
      .datetime({ message: t("validation.appointments.invalidDatetime") })
      .optional(),
    to: z
      .string()
      .datetime({ message: t("validation.appointments.invalidDatetime") })
      .optional(),
  }),

  // Generate slots from schedule rules (staff/admin action)
  generate: z.object({
    doctorId: z.string().uuid(t("validation.invalidUuid")),
    from: z.string().datetime({ message: t("validation.appointments.invalidDatetime") }),
    to: z.string().datetime({ message: t("validation.appointments.invalidDatetime") }),
  }),

  // Book a slot
  book: z.object({
    appointmentId: z.string().uuid(t("validation.invalidUuid")),
  }),

  // Block/unblock a slot manually
  updateStatus: z.object({
    status: z.enum(["available", "blocked"] as const),
  }),
});

export type ListSlotsQuery = z.infer<ReturnType<typeof createSlotTimeSchemas>["listQuery"]>;
export type GenerateSlotsInput = z.infer<ReturnType<typeof createSlotTimeSchemas>["generate"]>;
export type BookSlotInput = z.infer<ReturnType<typeof createSlotTimeSchemas>["book"]>;
export type UpdateSlotStatusInput = z.infer<ReturnType<typeof createSlotTimeSchemas>["updateStatus"]>;
