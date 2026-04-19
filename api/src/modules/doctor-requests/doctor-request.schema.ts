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
import { clinics } from "../clinics/clinic.schema.js";
import { staffUsers } from "../staff-users/staff-user.schema.js";
import { doctorSpecialtyEnum } from "../doctors/doctor.schema.js";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const doctorRequestTypeEnum = pgEnum("doctor_request_type", [
  "join",    // join an existing clinic
  "create",  // create a new clinic and become its first doctor
]);

export const doctorRequestStatusEnum = pgEnum("doctor_request_status", [
  "pending",
  "approved",
  "rejected",
]);

// ─── Table ────────────────────────────────────────────────────────────────────

export const doctorRequests = pgTable(
  "doctor_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    type: doctorRequestTypeEnum("type").notNull(),

    // ── join: required. create: null (clinic doesn't exist yet) ──────────
    clinicId: uuid("clinic_id")
      .references(() => clinics.id, { onDelete: "set null" }),

    // ── Doctor info ───────────────────────────────────────────────────────
    name: varchar("name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    specialty: doctorSpecialtyEnum("specialty").notNull(),
    experienceYears: integer("experience_years"),

    // ── create type only ──────────────────────────────────────────────────
    clinicName: varchar("clinic_name", { length: 200 }),
    clinicAddress: text("clinic_address"),

    // ── Workflow ──────────────────────────────────────────────────────────
    status: doctorRequestStatusEnum("status").default("pending").notNull(),

    reviewedBy: uuid("reviewed_by")
      .references(() => staffUsers.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // Staff dashboard: pending requests per type
    typeStatusIdx: index("doctor_requests_type_status_idx").on(t.type, t.status),
    // Join requests scoped to a clinic
    clinicStatusIdx: index("doctor_requests_clinic_status_idx").on(t.clinicId, t.status),
    // Reviewer FK
    reviewedByIdx: index("doctor_requests_reviewed_by_idx").on(t.reviewedBy),
    // Duplicate detection: pending join requests per email per clinic
    emailIdx: index("doctor_requests_email_idx").on(t.email),
  })
);

export type DoctorRequest = typeof doctorRequests.$inferSelect;
export type NewDoctorRequest = typeof doctorRequests.$inferInsert;
