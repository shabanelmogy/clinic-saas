import {
  pgTable,
  uuid,
  smallint,
  time,
  boolean,
  timestamp,
  index,
  unique,
  pgEnum,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { doctors } from "../doctors/doctor.schema.js";
import { clinics } from "../clinics/clinic.schema.js";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const dayOfWeekEnum = pgEnum("day_of_week", [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
]);

// ─── Doctor Schedules ─────────────────────────────────────────────────────────

/**
 * doctor_schedules — recurring weekly availability RULES only.
 *
 * These are templates, NOT bookable slots.
 * A background job reads these rules and generates slot_times rows.
 *
 * ✅ One row per (doctorId, dayOfWeek) — unique constraint
 * ✅ clinicId denormalized for tenant isolation on queries
 * ✅ CHECK: endTime > startTime — enforced at DB level
 */
export const doctorSchedules = pgTable(
  "doctor_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "restrict" }),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    dayOfWeek: dayOfWeekEnum("day_of_week").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    slotDurationMinutes: smallint("slot_duration_minutes").default(30).notNull(),
    maxAppointments: smallint("max_appointments").default(1).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // One rule per doctor per day of week
    doctorDayUnique: unique("doctor_schedules_doctor_day_unique").on(t.doctorId, t.dayOfWeek),
    clinicIdx: index("doctor_schedules_clinic_idx").on(t.clinicId),
    doctorIdx: index("doctor_schedules_doctor_idx").on(t.doctorId),
    // Active rules per clinic per day — slot generation query
    clinicDayActiveIdx: index("doctor_schedules_clinic_day_active_idx")
      .on(t.clinicId, t.dayOfWeek, t.isActive),
    // DB-level guards
    timeOrderCheck: check("chk_schedule_time_order", sql`${t.endTime} > ${t.startTime}`),
    slotDurationCheck: check("chk_slot_duration", sql`${t.slotDurationMinutes} >= 5 AND ${t.slotDurationMinutes} <= 480`),
    maxAppointmentsCheck: check("chk_max_appointments", sql`${t.maxAppointments} >= 1 AND ${t.maxAppointments} <= 50`),
  })
);

export type DoctorSchedule = typeof doctorSchedules.$inferSelect;
export type NewDoctorSchedule = typeof doctorSchedules.$inferInsert;
