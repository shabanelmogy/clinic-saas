import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";

// ─── Users Table ──────────────────────────────────────────────────────────────

/**
 * GLOBAL Users table (Patients / end-users of the marketplace).
 *
 * ✅ NO clinic_id — users are global entities.
 * ✅ A patient signs in once and can interact with ANY clinic.
 * ✅ Email is globally unique across the entire platform.
 *
 * Clinic employees (doctors, admins, receptionists) are stored in
 * the clinic_staff table inside the clinics module.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // ✅ NO clinic_id — users are GLOBAL
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // ✅ Email is globally unique (not per clinic)
    emailUnique: unique("users_email_unique").on(t.email),
    emailIdx: index("users_email_idx").on(t.email),
    isActiveIdx: index("users_is_active_idx").on(t.isActive),
  })
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
