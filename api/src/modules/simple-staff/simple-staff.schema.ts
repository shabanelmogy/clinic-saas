import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  primaryKey,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { clinics } from "../clinics/clinic.schema.js";

// ─── Role enum ────────────────────────────────────────────────────────────────

export const simpleStaffRoleEnum = pgEnum("simple_staff_role", [
  "super_admin",   // full platform access
  "manager",       // manage clinic operations
  "receptionist",  // front-desk, appointments
]);

// ─── Staff users ──────────────────────────────────────────────────────────────

export const simpleStaffUsers = pgTable(
  "simple_staff_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: simpleStaffRoleEnum("role").notNull(),

    // ✅ true  → access ALL clinics, no entry needed in simple_staff_clinics
    // ✅ false → access ONLY clinics listed in simple_staff_clinics
    isGlobal: boolean("is_global").default(false).notNull(),

    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailUnique: unique("simple_staff_users_email_unique").on(t.email),
    emailIdx: index("simple_staff_users_email_idx").on(t.email),
    roleIdx: index("simple_staff_users_role_idx").on(t.role),
    globalIdx: index("simple_staff_users_global_idx").on(t.isGlobal),
  })
);

// ─── Staff ↔ Clinic assignments ───────────────────────────────────────────────

export const simpleStaffClinics = pgTable(
  "simple_staff_clinics",
  {
    staffUserId: uuid("staff_user_id")
      .notNull()
      .references(() => simpleStaffUsers.id, { onDelete: "cascade" }),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // Composite PK — prevents duplicate assignments at DB level
    pk: primaryKey({ columns: [t.staffUserId, t.clinicId] }),
    // Fast lookup: "which clinics can this staff member access?"
    staffIdx: index("simple_staff_clinics_staff_idx").on(t.staffUserId),
    // Fast lookup: "which staff members are assigned to this clinic?"
    clinicIdx: index("simple_staff_clinics_clinic_idx").on(t.clinicId),
  })
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type SimpleStaffUser = typeof simpleStaffUsers.$inferSelect;
export type NewSimpleStaffUser = typeof simpleStaffUsers.$inferInsert;
export type SimpleStaffClinic = typeof simpleStaffClinics.$inferSelect;

// Safe type — never expose passwordHash over the wire
export type SafeSimpleStaffUser = Omit<SimpleStaffUser, "passwordHash">;
