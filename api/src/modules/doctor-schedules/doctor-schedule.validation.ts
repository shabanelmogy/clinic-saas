import { z } from "zod";
import { dayOfWeekEnum } from "./doctor-schedule.schema.js";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export const createDoctorScheduleSchemas = (t: TranslateFn) => ({
  upsert: z.object({
    dayOfWeek: z.enum(dayOfWeekEnum.enumValues),
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, t("validation.doctors.invalidTime")),
    endTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, t("validation.doctors.invalidTime")),
    slotDurationMinutes: z.coerce
      .number()
      .int()
      .min(5, t("validation.min", { field: "Slot duration", min: 5 }))
      .max(480, t("validation.max", { field: "Slot duration", max: 480 }))
      .default(30),
    maxAppointments: z.coerce.number().int().min(1).max(50).default(1),
    isActive: z.boolean().default(true),
  }),
});

export const dayOfWeekParamSchema = z.object({
  doctorId: z.string().uuid(),
  day: z.enum(dayOfWeekEnum.enumValues),
});

export type UpsertScheduleInput = z.infer<ReturnType<typeof createDoctorScheduleSchemas>["upsert"]>;
