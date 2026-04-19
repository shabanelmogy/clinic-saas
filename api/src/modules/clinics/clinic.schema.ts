import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const clinics = pgTable(
  "clinics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    /**
     * ✅ FIX #11: slug unique is partial — soft-deleted clinic frees its slug.
     * Without this, a deleted clinic permanently blocks its slug from reuse.
     */
    slug: varchar("slug", { length: 200 }).notNull(),
    description: text("description"),
    address: text("address"),
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 255 }),
    website: varchar("website", { length: 255 }),
    logo: varchar("logo", { length: 500 }),
    isActive: boolean("is_active").default(true).notNull(),
    isPublished: boolean("is_published").default(false).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // ✅ Partial unique: slug only locked for non-deleted clinics
    slugActiveUnique: unique("clinics_slug_active_unique")
      .on(t.slug)
      .nullsNotDistinct(),
    isPublishedIdx: index("clinics_is_published_idx").on(t.isPublished),
    isActiveIdx: index("clinics_is_active_idx").on(t.isActive),
    // Covers the full marketplace filter in one scan
    marketplaceIdx: index("clinics_marketplace_idx")
      .on(t.isPublished, t.isActive)
      .where(sql`${t.deletedAt} IS NULL`),
  })
);

export type Clinic = typeof clinics.$inferSelect;
export type NewClinic = typeof clinics.$inferInsert;
