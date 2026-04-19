import {
  pgTable,
  uuid,
  timestamp,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { clinics } from "../clinics/clinic.schema.js";
import { doctors } from "../doctors/doctor.schema.js";
import { appointments } from "../appointments/appointment.schema.js";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const slotStatusEnum = pgEnum("slot_status", [
  "available",  // generated, not yet booked
  "booked",     // linked to an appointment
  "blocked",    // manually blocked by staff (holiday, break, etc.)
]);

// ─── Slot Times ───────────────────────────────────────────────────────────────

/**
 * slot_times — the source of truth for bookable availability.
 *
 * Generated from doctor_schedules (weekly rules) by a background job.
 * Patients and staff query THIS table — never calculate availability at runtime.
 *
 * ✅ clinic_id — tenant isolation on every query
 * ✅ UNIQUE (doctor_id, start_time) — prevents duplicate slots / double booking
 * ✅ appointment_id — set when booked, cleared on cancellation
 *
 * Booking flow:
 *   1. Query available slots: WHERE status = 'available' AND doctor_id = ? AND clinic_id = ?
 *   2. Book: UPDATE SET status = 'booked', appointment_id = ? WHERE id = ? AND status = 'available'
 *   3. Cancel: UPDATE SET status = 'available', appointment_id = NULL WHERE id = ? AND status = 'booked'
 */
export const slotTimes = pgTable(
  "slot_times",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // ✅ Tenant isolation — always required
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "restrict" }),

    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),

    // Full timestamps — not just time — represent the actual calendar slot
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),

    status: slotStatusEnum("status").default("available").notNull(),

    // Set when booked, NULL when available or blocked
    appointmentId: uuid("appointment_id")
      .references(() => appointments.id, { onDelete: "set null" }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // ✅ Core double-booking prevention — one slot per doctor per start time
    doctorStartTimeUnique: unique("slot_times_doctor_start_time_unique")
      .on(t.doctorId, t.startTime),

    // ✅ Tenant isolation index — all queries start with clinic_id
    clinicIdx: index("slot_times_clinic_idx").on(t.clinicId),

    // ✅ Doctor availability query: WHERE doctor_id = ? AND status = 'available'
    doctorIdx: index("slot_times_doctor_idx").on(t.doctorId),

    // ✅ Status filter — most queries filter by status
    statusIdx: index("slot_times_status_idx").on(t.status),

    // ✅ Primary availability query: clinic + doctor + status + time range
    clinicDoctorStatusIdx: index("slot_times_clinic_doctor_status_idx")
      .on(t.clinicId, t.doctorId, t.status, t.startTime),

    // ✅ Clinic-wide availability (e.g. "any available doctor today")
    clinicStatusTimeIdx: index("slot_times_clinic_status_time_idx")
      .on(t.clinicId, t.status, t.startTime),

    // ✅ Appointment lookup — find slot by appointment_id on cancellation
    appointmentIdx: index("slot_times_appointment_idx").on(t.appointmentId),
  })
);

export type SlotTime = typeof slotTimes.$inferSelect;
export type NewSlotTime = typeof slotTimes.$inferInsert;
