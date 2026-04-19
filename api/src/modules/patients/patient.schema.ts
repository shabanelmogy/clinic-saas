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
import { clinics } from "../clinics/clinic.schema.js";

export const patientBloodTypeEnum = pgEnum("patient_blood_type", [
  "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-",
]);

export const patientGenderEnum = pgEnum("patient_gender", [
  "male", "female", "other",
]);

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "restrict" }),
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
    clinicIdx: index("patients_clinic_idx").on(t.clinicId),
    // Active patients per clinic — primary list query
    clinicActiveIdx: index("patients_clinic_active_idx")
      .on(t.clinicId, t.isActive)
      .where(sql`${t.deletedAt} IS NULL`),
    phoneIdx: index("patients_phone_idx").on(t.phone),
    /**
     * ✅ email unique per clinic — only enforced when email IS NOT NULL.
     * Without nullsNotDistinct(), NULL != NULL so multiple patients can have
     * no email in the same clinic.
     */
    emailClinicActiveUnique: unique("patients_email_clinic_unique")
      .on(t.email, t.clinicId),
    /**
     * ✅ nationalId unique per clinic — only enforced when nationalId IS NOT NULL.
     * Without nullsNotDistinct(), PostgreSQL treats NULL != NULL in unique constraints,
     * so multiple patients can have NULL nationalId in the same clinic.
     */
    nationalIdClinicUnique: unique("patients_national_id_clinic_unique")
      .on(t.nationalId, t.clinicId),
  })
);

export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
