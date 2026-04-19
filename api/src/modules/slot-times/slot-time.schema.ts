import {
  pgTable,
  uuid,
  timestamp,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { clinics } from "../clinics/clinic.schema.js";
import { doctors } from "../doctors/doctor.schema.js";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const slotStatusEnum = pgEnum("slot_status", [
  "available",  // generated, not yet booked
  "booked",     // linked to an appointment
  "blocked",    // manually blocked by staff (holiday, break, etc.)
]);

// ─── Slot Times ───────────────────────────────────────────────────────────────

/**
 * slot_times — source of truth for bookable availability.
 *
 * Generated from doctor_schedules (weekly rules) by a background job.
 * Patients and staff query THIS table — never calculate availability at runtime.
 *
 * ─── Booking flow (atomic, race-safe) ────────────────────────────────────────
 *
 *   BEGIN;
 *     -- 1. Lock the slot row — blocks concurrent bookings on same slot
 *     SELECT id FROM slot_times
 *       WHERE id = $slotId AND status = 'available'
 *       FOR UPDATE;
 *
 *     -- 2. If no row returned → slot taken → ROLLBACK, return 409
 *
 *     -- 3. Create appointment row (slot_id links back to this slot)
 *     INSERT INTO appointments (..., slot_id) VALUES (..., $slotId);
 *
 *     -- 4. Mark slot booked — optimistic guard catches any race
 *     UPDATE slot_times
 *       SET status = 'booked', updated_at = now()
 *       WHERE id = $slotId AND status = 'available';
 *
 *     -- 5. If UPDATE affected 0 rows → race condition → ROLLBACK, return 409
 *   COMMIT;
 *
 * ─── Cancellation flow ────────────────────────────────────────────────────────
 *
 *   BEGIN;
 *     UPDATE appointments SET status = 'cancelled', updated_at = now()
 *       WHERE id = $appointmentId;
 *
 *     UPDATE slot_times SET status = 'available', updated_at = now()
 *       WHERE id = (SELECT slot_id FROM appointments WHERE id = $appointmentId)
 *         AND status = 'booked';
 *   COMMIT;
 *
 * ─── Circular import resolution ───────────────────────────────────────────────
 *
 * slot_times no longer holds appointment_id FK.
 * appointments holds slot_id FK instead (single source of truth).
 *
 *   OLD (circular): slot_times → appointments → slot_times  ❌
 *   NEW (clean):    appointments → slot_times               ✅
 */
export const slotTimes = pgTable(
  "slot_times",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // ✅ Tenant isolation — always required, never nullable
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "restrict" }),

    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),

    // Full timestamps with timezone — represent the actual calendar slot
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),

    status: slotStatusEnum("status").default("available").notNull(),

    // ✅ Track when slot status last changed — required for audit and debugging
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // ✅ Core double-booking prevention — one slot per doctor per start time
    doctorStartTimeUnique: unique("slot_times_doctor_start_time_unique")
      .on(t.doctorId, t.startTime),

    // ✅ Tenant isolation — all queries start with clinic_id
    clinicIdx: index("slot_times_clinic_idx").on(t.clinicId),

    // ✅ Doctor FK index
    doctorIdx: index("slot_times_doctor_idx").on(t.doctorId),

    // ✅ Status filter
    statusIdx: index("slot_times_status_idx").on(t.status),

    // ✅ Primary availability query: clinic + doctor + status + time range
    // Covers: WHERE clinic_id = ? AND doctor_id = ? AND status = ? AND start_time >= ?
    clinicDoctorStatusIdx: index("slot_times_clinic_doctor_status_idx")
      .on(t.clinicId, t.doctorId, t.status, t.startTime),

    // ✅ Clinic-wide availability: "any available doctor today"
    clinicStatusTimeIdx: index("slot_times_clinic_status_time_idx")
      .on(t.clinicId, t.status, t.startTime),

    // ✅ Partial index — available slots only (hot path for booking queries)
    // Smaller and faster than full index — only indexes bookable rows
    availableIdx: index("slot_times_available_idx")
      .on(t.clinicId, t.doctorId, t.startTime)
      .where(sql`status = 'available'`),
  })
);

export type SlotTime = typeof slotTimes.$inferSelect;
export type NewSlotTime = typeof slotTimes.$inferInsert;
