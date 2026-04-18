import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";
import { users } from "../users/user.schema.js";

// ─── Roles Table ──────────────────────────────────────────────────────────────

/**
 * Roles table.
 * clinicId = NULL  → global role (e.g. "Patient", "Super Admin")
 * clinicId = UUID  → clinic-specific role (e.g. "Doctor @ Clinic A")
 */
export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    description: varchar("description", { length: 500 }),
    clinicId: uuid("clinic_id"), // NULL = global role, UUID = clinic-specific role
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    nameClinicIdx: unique("roles_name_clinic_unique").on(t.name, t.clinicId),
    clinicIdx: index("roles_clinic_idx").on(t.clinicId),
  })
);

// ─── Permissions Table (FIXED - Seeded) ──────────────────────────────────────

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 100 }).notNull().unique(), // e.g., "users:create"
    name: varchar("name", { length: 100 }).notNull(),
    description: varchar("description", { length: 500 }),
    category: varchar("category", { length: 50 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    keyIdx: index("permissions_key_idx").on(t.key),
    categoryIdx: index("permissions_category_idx").on(t.category),
  })
);

// ─── Role Permissions (Many-to-Many) ──────────────────────────────────────────

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
    roleIdx: index("role_permissions_role_idx").on(t.roleId),
    permissionIdx: index("role_permissions_permission_idx").on(t.permissionId),
  })
);

// ─── User Roles (Many-to-Many) ────────────────────────────────────────────────

/**
 * User ↔ Role assignments.
 * Users are GLOBAL — a patient can have a global "Patient" role.
 * Clinic staff get clinic-specific roles via this same table.
 */
export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    // Optional: scope this assignment to a specific clinic
    // NULL = global assignment (e.g. Patient role)
    // UUID = clinic-scoped assignment (e.g. Doctor at Clinic A)
    clinicId: uuid("clinic_id"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
    assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.roleId] }),
    userIdx: index("user_roles_user_idx").on(t.userId),
    roleIdx: index("user_roles_role_idx").on(t.roleId),
    clinicIdx: index("user_roles_clinic_idx").on(t.clinicId),
  })
);

// ─── Re-export User Types ─────────────────────────────────────────────────────

export { users, type User, type NewUser } from "../users/user.schema.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;

export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;

export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;

export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;
