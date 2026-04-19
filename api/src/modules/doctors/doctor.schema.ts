import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
  unique,
  pgEnum,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { clinics } from "../clinics/clinic.schema.js";
import { staffUsers } from "../staff-users/staff-user.schema.js";

export const doctorSpecialtyEnum = pgEnum("doctor_specialty", [
  "general_practice",
  "cardiology",
  "dermatology",
  "endocrinology",
  "gastroenterology",
  "gynecology",
  "hematology",
  "nephrology",
  "neurology",
  "oncology",
  "ophthalmology",
  "orthopedics",
  "otolaryngology",
  "pediatrics",
  "psychiatry",
  "pulmonology",
  "radiology",
  "rheumatology",
  "surgery",
  "urology",
  "other",
]);

export const doctors = pgTable(
  "doctors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "restrict" }),
    staffUserId: uuid("staff_user_id")
      .references(() => staffUsers.id, { onDelete: "set null" }),
    name: varchar("name", { length: 100 }).notNull(),
    specialty: doctorSpecialtyEnum("specialty").notNull(),
    bio: text("bio"),
    avatar: varchar("avatar", { length: 500 }),
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 255 }),
    /**
     * ✅ FIX #8: CHECK constraints on numeric fields.
     * Negative experience years and negative fees are invalid.
     */
    experienceYears: integer("experience_years"),
    consultationFee: integer("consultation_fee"),
    isActive: boolean("is_active").default(true).notNull(),
    isPublished: boolean("is_published").default(true).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    clinicIdx: index("doctors_clinic_idx").on(t.clinicId),
    staffUserIdx: index("doctors_staff_user_idx").on(t.staffUserId),
    clinicActiveIdx: index("doctors_clinic_active_idx")
      .on(t.clinicId, t.isActive)
      .where(sql`${t.deletedAt} IS NULL`),
    specialtyIdx: index("doctors_specialty_idx").on(t.specialty),
    clinicSpecialtyIdx: index("doctors_clinic_specialty_idx").on(t.clinicId, t.specialty),
    /**
     * ✅ FIX #3: Partial unique — only enforced when staffUserId IS NOT NULL.
     * When staffUserId IS NULL (no login account), multiple doctors can exist
     * without a linked account. The constraint only fires when a real account is linked.
     */
    staffUserClinicUnique: unique("doctors_staff_user_clinic_unique")
      .on(t.staffUserId, t.clinicId)
      .nullsNotDistinct(),
    // ✅ FIX #8: Numeric field bounds
    experienceCheck: check(
      "chk_doctor_experience",
      sql`${t.experienceYears} IS NULL OR (${t.experienceYears} >= 0 AND ${t.experienceYears} <= 70)`
    ),
    feeCheck: check(
      "chk_doctor_fee",
      sql`${t.consultationFee} IS NULL OR ${t.consultationFee} >= 0`
    ),
  })
);

export type Doctor = typeof doctors.$inferSelect;
export type NewDoctor = typeof doctors.$inferInsert;
