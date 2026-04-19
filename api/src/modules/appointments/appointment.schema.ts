import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  pgEnum,
  index,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { clinics } from "../clinics/clinic.schema.js";
import { patients } from "../patients/patient.schema.js";
import { doctors } from "../doctors/doctor.schema.js";
import { staffUsers } from "../staff-users/staff-user.schema.js";
import { slotTimes } from "../slot-times/slot-time.schema.js";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);

// ─── Appointments ─────────────────────────────────────────────────────────────

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "restrict" }),

    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "restrict" }),

    doctorId: uuid("doctor_id")
      .references(() => doctors.id, { onDelete: "set null" }),

    // ✅ IMPROVEMENT #1: Hard FK to the slot this appointment occupies.
    //
    // Single source of truth for the appointment ↔ slot relationship.
    // slot_times no longer holds appointment_id — this is the owning side.
    //
    // SET NULL on slot delete (e.g. slot regeneration) — appointment survives
    // but loses its slot link. Service layer must handle this case.
    //
    // UNIQUE: one slot → one appointment (enforced at DB level)
    slotId: uuid("slot_id")
      .references(() => slotTimes.id, { onDelete: "set null" })
      .unique(),

    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),

    // ✅ IMPROVEMENT #2: scheduledAt is a DENORMALIZED CACHE of slot_times.start_time.
    //
    // Purpose: allows querying appointments by time WITHOUT joining slot_times.
    // This is intentional denormalization for read performance on dashboards.
    //
    // Contract:
    //   - Set from slot_times.start_time at booking time
    //   - If slot is NULL (walk-in / manual booking), set directly
    //   - Must be kept in sync with slot_times.start_time if slot is rescheduled
    //   - Never used as the authoritative time when slotId IS NOT NULL
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),

    durationMinutes: integer("duration_minutes").default(60).notNull(),
    status: appointmentStatusEnum("status").default("pending").notNull(),
    notes: text("notes"),

    // ✅ IMPROVEMENT #3: Optimistic locking — prevents lost updates.
    //
    // Usage in service layer:
    //   UPDATE appointments SET ..., version = version + 1
    //   WHERE id = $id AND version = $expectedVersion
    //   If 0 rows affected → concurrent update detected → return 409
    version: integer("version").default(0).notNull(),

    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // ── FK indexes ────────────────────────────────────────────────────────────
    clinicIdx: index("appointments_clinic_idx").on(t.clinicId),
    patientIdx: index("appointments_patient_idx").on(t.patientId),
    doctorIdx: index("appointments_doctor_idx").on(t.doctorId),
    slotIdx: index("appointments_slot_idx").on(t.slotId),

    // ── Single-column indexes ─────────────────────────────────────────────────
    scheduledAtIdx: index("appointments_scheduled_at_idx").on(t.scheduledAt),
    statusIdx: index("appointments_status_idx").on(t.status),

    // ── Composite indexes ─────────────────────────────────────────────────────

    // Staff dashboard: clinic appointments by time (active only)
    clinicScheduledIdx: index("appointments_clinic_scheduled_idx")
      .on(t.clinicId, t.scheduledAt)
      .where(sql`${t.deletedAt} IS NULL`),

    // Staff filter by status (active only)
    clinicStatusIdx: index("appointments_clinic_status_idx")
      .on(t.clinicId, t.status)
      .where(sql`${t.deletedAt} IS NULL`),

    // Patient history view (active only)
    clinicPatientIdx: index("appointments_clinic_patient_idx")
      .on(t.clinicId, t.patientId)
      .where(sql`${t.deletedAt} IS NULL`),

    // Doctor schedule view (active, non-terminal statuses)
    doctorScheduledIdx: index("appointments_doctor_scheduled_idx")
      .on(t.doctorId, t.scheduledAt)
      .where(sql`${t.deletedAt} IS NULL AND ${t.status} NOT IN ('cancelled', 'no_show')`),

    // ── Unique constraints ────────────────────────────────────────────────────

    // Double-booking prevention: one active appointment per doctor per time per clinic
    // nullsNotDistinct: NULL doctorId rows don't compete with each other
    doctorDoubleBookingUnique: unique("appointments_doctor_no_double_booking")
      .on(t.doctorId, t.scheduledAt, t.clinicId)
      .nullsNotDistinct(),

    // ── CHECK constraints ─────────────────────────────────────────────────────
    durationCheck: check(
      "chk_appointment_duration",
      sql`${t.durationMinutes} > 0 AND ${t.durationMinutes} <= 480`
    ),
    versionCheck: check(
      "chk_appointment_version",
      sql`${t.version} >= 0`
    ),
  })
);

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;

// ─── Appointment History ──────────────────────────────────────────────────────

export const appointmentHistory = pgTable(
  "appointment_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),

    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "restrict" }),

    previousStatus: appointmentStatusEnum("previous_status"),
    newStatus: appointmentStatusEnum("new_status").notNull(),

    changedBy: uuid("changed_by")
      .references(() => staffUsers.id, { onDelete: "set null" }),

    reason: text("reason"),

    // Append-only — never updated, always set at insert time
    changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // Timeline query: full history for one appointment ordered by time
    appointmentTimelineIdx: index("appt_history_timeline_idx")
      .on(t.appointmentId, t.changedAt),

    // Clinic-level audit (compliance, reporting)
    clinicAuditIdx: index("appt_history_clinic_idx")
      .on(t.clinicId, t.changedAt),

    // Staff activity audit: who changed what
    changedByIdx: index("appt_history_changed_by_idx")
      .on(t.changedBy, t.changedAt),
  })
);

export type AppointmentHistory = typeof appointmentHistory.$inferSelect;
export type NewAppointmentHistory = typeof appointmentHistory.$inferInsert;
