import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
  boolean,
  pgEnum,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const patientBloodTypeEnum = pgEnum("patient_blood_type", [
  "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-",
]);

export const patientGenderEnum = pgEnum("patient_gender", [
  "male", "female", "other",
]);

/**
 * patients — global identity table.
 *
 * A patient is a person, not a clinic record.
 * They can book appointments at ANY clinic.
 * clinic_id has been removed — patients are not owned by a clinic.
 */
export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // ✅ No clinic_id — patients are global, not clinic-owned
    name: varchar("name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 255 }),
    dateOfBirth: date("date_of_birth"),
    gender: patientGenderEnum("gender"),
    bloodType: patientBloodTypeEnum("blood_type"),
    allergies: text("allergies"),
    medicalNotes: text("medical_notes"),
    emergencyContactName: varchar("emergency_contact_name", { length: 100 }),
    emergencyContactPhone: varchar("emergency_contact_phone", { length: 20 }),
    address: text("address"),
    nationalId: varchar("national_id", { length: 50 }),
    isActive: boolean("is_active").default(true).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // Active patients index
    activeIdx: index("patients_active_idx")
      .on(t.isActive)
      .where(sql`${t.deletedAt} IS NULL`),
    phoneIdx: index("patients_phone_idx").on(t.phone),
    // Global unique constraints — phone and email are unique across all clinics
    phoneUnique: unique("patients_phone_unique").on(t.phone),
    emailUnique: unique("patients_email_unique").on(t.email),
    nationalIdUnique: unique("patients_national_id_unique").on(t.nationalId),
  })
);

export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
