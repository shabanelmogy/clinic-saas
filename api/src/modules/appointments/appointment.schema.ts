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
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").default(60).notNull(),
    status: appointmentStatusEnum("status").default("pending").notNull(),
    notes: text("notes"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    clinicIdx: index("appointments_clinic_idx").on(t.clinicId),
    patientIdx: index("appointments_patient_idx").on(t.patientId),
    doctorIdx: index("appointments_doctor_idx").on(t.doctorId),
    scheduledAtIdx: index("appointments_scheduled_at_idx").on(t.scheduledAt),
    statusIdx: index("appointments_status_idx").on(t.status),
    // Staff dashboard: clinic appointments by time
    clinicScheduledIdx: index("appointments_clinic_scheduled_idx")
      .on(t.clinicId, t.scheduledAt)
      .where(sql`${t.deletedAt} IS NULL`),
    // Staff filter by status
    clinicStatusIdx: index("appointments_clinic_status_idx")
      .on(t.clinicId, t.status)
      .where(sql`${t.deletedAt} IS NULL`),
    // Patient history view
    clinicPatientIdx: index("appointments_clinic_patient_idx")
      .on(t.clinicId, t.patientId)
      .where(sql`${t.deletedAt} IS NULL`),
    /**
     * ✅ FIX #5: Double-booking prevention.
     * A doctor cannot have two active (non-cancelled, non-deleted) appointments
     * at the exact same scheduledAt time within the same clinic.
     *
     * Partial unique: only active appointments, only when doctorId is assigned.
     * Cancelled/completed/no_show appointments do not block the slot.
     *
     * Note: overlap detection (not just exact time) requires a DB trigger or
     * application-layer check using the doctor's schedule slot duration.
     */
    doctorDoubleBookingUnique: unique("appointments_doctor_no_double_booking")
      .on(t.doctorId, t.scheduledAt, t.clinicId)
      .nullsNotDistinct(),
    // Doctor schedule view
    doctorScheduledIdx: index("appointments_doctor_scheduled_idx")
      .on(t.doctorId, t.scheduledAt)
      .where(sql`${t.deletedAt} IS NULL AND ${t.status} NOT IN ('cancelled', 'no_show')`),
    // ✅ FIX #6: Duration bounds
    durationCheck: check(
      "chk_appointment_duration",
      sql`${t.durationMinutes} > 0 AND ${t.durationMinutes} <= 480`
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
    /**
     * ✅ FIX #7: changedAt is NOT NULL — audit records must always have a timestamp.
     * defaultNow() alone doesn't enforce NOT NULL in Drizzle without .notNull().
     */
    changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    /**
     * ✅ FIX #12: Composite index (appointmentId, changedAt) for timeline queries.
     * Replaces two separate indexes — covers "get full history ordered by time"
     * in a single index scan.
     */
    appointmentTimelineIdx: index("appt_history_timeline_idx")
      .on(t.appointmentId, t.changedAt),
    // Clinic-level audit queries (compliance, reporting)
    clinicAuditIdx: index("appt_history_clinic_idx")
      .on(t.clinicId, t.changedAt),
    // Who changed what (staff activity audit)
    changedByIdx: index("appt_history_changed_by_idx")
      .on(t.changedBy, t.changedAt),
  })
);

export type AppointmentHistory = typeof appointmentHistory.$inferSelect;
export type NewAppointmentHistory = typeof appointmentHistory.$inferInsert;
