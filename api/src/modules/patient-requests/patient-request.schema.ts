import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  date,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { clinics } from "../clinics/clinic.schema.js";
import { staffUsers } from "../staff-users/staff-user.schema.js";
import { slotTimes } from "../slot-times/slot-time.schema.js";
import { patientGenderEnum } from "../patients/patient.schema.js";

// ─── Status enum ──────────────────────────────────────────────────────────────

export const patientRequestStatusEnum = pgEnum("patient_request_status", [
  "pending",
  "approved",
  "rejected",
]);

// ─── Table ────────────────────────────────────────────────────────────────────

export const patientRequests = pgTable(
  "patient_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // ✅ Nullable — patient may not know which clinic to register with.
    //    Staff must assign a clinic before the request can be approved.
    clinicId: uuid("clinic_id")
      .references(() => clinics.id, { onDelete: "set null" }),

    // ── Patient info ──────────────────────────────────────────────────────
    name: varchar("name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    email: varchar("email", { length: 255 }),
    dateOfBirth: date("date_of_birth"),
    gender: patientGenderEnum("gender"),

    // ── Optional booking intent ───────────────────────────────────────────
    preferredSlotId: uuid("preferred_slot_id")
      .references(() => slotTimes.id, { onDelete: "set null" }),
    autoBook: boolean("auto_book").default(false).notNull(),

    // ── Workflow state ────────────────────────────────────────────────────
    status: patientRequestStatusEnum("status").default("pending").notNull(),

    reviewedBy: uuid("reviewed_by")
      .references(() => staffUsers.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // Clinic-scoped staff queries
    clinicIdx: index("patient_requests_clinic_idx").on(t.clinicId),
    // Primary dashboard filter: pending per clinic
    clinicStatusIdx: index("patient_requests_clinic_status_idx")
      .on(t.clinicId, t.status)
      .where(sql`${t.clinicId} IS NOT NULL`),
    // Unassigned requests queue (clinicId IS NULL)
    unassignedIdx: index("patient_requests_unassigned_idx")
      .on(t.status)
      .where(sql`${t.clinicId} IS NULL`),
    // Global status filter (super admin)
    statusIdx: index("patient_requests_status_idx").on(t.status),
    slotIdx: index("patient_requests_slot_idx").on(t.preferredSlotId),
    reviewedByIdx: index("patient_requests_reviewed_by_idx").on(t.reviewedBy),
  })
);

export type PatientRequest = typeof patientRequests.$inferSelect;
export type NewPatientRequest = typeof patientRequests.$inferInsert;
