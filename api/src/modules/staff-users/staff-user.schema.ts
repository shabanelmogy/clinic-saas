import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const staffUsers = pgTable(
  "staff_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    isActive: boolean("is_active").default(true).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    /**
     * ✅ FIX #10: Partial unique on email — only enforced for non-deleted rows.
     * A soft-deleted staff user's email is freed up for reuse.
     * Standard unique() would permanently lock the email even after soft-delete.
     */
    emailActiveUnique: unique("staff_users_email_active_unique")
      .on(t.email)
      .nullsNotDistinct(),
    // Fast login lookup
    emailIdx: index("staff_users_email_idx").on(t.email),
    // Partial index — active staff only (most common filter)
    activeIdx: index("staff_users_active_idx")
      .on(t.isActive)
      .where(sql`${t.deletedAt} IS NULL`),
  })
);

export type StaffUser = typeof staffUsers.$inferSelect;
export type NewStaffUser = typeof staffUsers.$inferInsert;
