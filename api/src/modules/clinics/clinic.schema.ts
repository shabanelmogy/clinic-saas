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

// ─── Clinics Table ────────────────────────────────────────────────────────────

/**
 * Clinics table — tenant entities in the marketplace.
 *
 * - Each clinic is an independent tenant
 * - isPublished controls marketplace visibility
 * - Clinic staff are stored in clinic_staff table
 */
export const clinics = pgTable(
  "clinics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(), // URL-friendly identifier
    description: text("description"),
    address: text("address"),
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 255 }),
    website: varchar("website", { length: 255 }),
    logo: varchar("logo", { length: 500 }), // URL to logo image
    isActive: boolean("is_active").default(true).notNull(),
    isPublished: boolean("is_published").default(false).notNull(), // Marketplace visibility
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugUnique: unique("clinics_slug_unique").on(t.slug),
    isPublishedIdx: index("clinics_is_published_idx").on(t.isPublished),
    isActiveIdx: index("clinics_is_active_idx").on(t.isActive),
  })
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type Clinic = typeof clinics.$inferSelect;
export type NewClinic = typeof clinics.$inferInsert;
