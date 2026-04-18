import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { users } from "../users/user.schema.js";
import { clinics } from "../clinics/clinic.schema.js";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
]);

// ─── Table ────────────────────────────────────────────────────────────────────

/**
 * Appointments table — hybrid access model.
 *
 * ✅ patientId → references GLOBAL users (no clinic scope)
 * ✅ clinicId  → references clinics (tenant isolation for clinic-side queries)
 *
 * Access rules:
 *   Patient queries: filter by patientId ONLY — cross-clinic visibility
 *   Clinic queries:  ALWAYS filter by clinicId — strict tenant isolation
 */
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // ✅ Tenant: which clinic owns this appointment
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "restrict" }),
    // ✅ Global patient — NOT scoped to a clinic
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").default(60).notNull(),
    status: appointmentStatusEnum("status").default("pending").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // Clinic-side queries: always filter by clinicId
    clinicIdx: index("appointments_clinic_idx").on(t.clinicId),
    // Patient-side queries: filter by patientId only (cross-clinic)
    patientIdx: index("appointments_patient_idx").on(t.patientId),
    scheduledAtIdx: index("appointments_scheduled_at_idx").on(t.scheduledAt),
    statusIdx: index("appointments_status_idx").on(t.status),
    // Composite indexes for common queries
    clinicScheduledIdx: index("appointments_clinic_scheduled_idx").on(t.clinicId, t.scheduledAt),
    clinicStatusIdx: index("appointments_clinic_status_idx").on(t.clinicId, t.status),
    patientScheduledIdx: index("appointments_patient_scheduled_idx").on(t.patientId, t.scheduledAt),
  })
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
