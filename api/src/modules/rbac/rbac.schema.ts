import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  unique,
  primaryKey,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { staffUsers } from "../staff-users/staff-user.schema.js";
import { clinics } from "../clinics/clinic.schema.js";

// ─── Roles ────────────────────────────────────────────────────────────────────

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    description: varchar("description", { length: 500 }),
    clinicId: uuid("clinic_id")
      .references(() => clinics.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    /**
     * ✅ FIX #2: Two partial unique indexes instead of one standard unique.
     *
     * Standard unique(name, clinicId) allows duplicate (name, NULL) rows because
     * PostgreSQL treats NULL != NULL in unique constraints.
     *
     * Solution:
     *   - Global roles (clinicId IS NULL): unique on name alone
     *   - Clinic roles (clinicId IS NOT NULL): unique on (name, clinicId)
     */
    globalRoleNameUnique: unique("roles_global_name_unique")
      .on(t.name)
      .nullsNotDistinct(),
    clinicRoleNameUnique: unique("roles_clinic_name_unique")
      .on(t.name, t.clinicId)
      .nullsNotDistinct(),
    clinicIdx: index("roles_clinic_idx").on(t.clinicId),
  })
);

// ─── Permissions ──────────────────────────────────────────────────────────────

// ✅ IMPROVEMENT #6: category as pgEnum — prevents invalid categories at DB level,
// enables index-only scans on category, self-documents valid values.
export const permissionCategoryEnum = pgEnum("permission_category", [
  "users",
  "roles",
  "appointments",
  "clinic",
  "doctors",
  "patients",
  "slots",
  "reports",
  "system",
]);

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 100 }).notNull(),
    description: varchar("description", { length: 500 }),
    // ✅ Enum instead of varchar — DB-enforced, no invalid categories possible
    category: permissionCategoryEnum("category").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    keyIdx: index("permissions_key_idx").on(t.key),
    categoryIdx: index("permissions_category_idx").on(t.category),
  })
);

// ─── Role ↔ Permission (M:M) ──────────────────────────────────────────────────

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

// ─── StaffUser ↔ Role (M:M) ───────────────────────────────────────────────────

export const staffUserRoles = pgTable(
  "staff_user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffUserId: uuid("staff_user_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    clinicId: uuid("clinic_id")
      .references(() => clinics.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
    assignedBy: uuid("assigned_by")
      .references(() => staffUsers.id, { onDelete: "set null" }),
  },
  (t) => ({
    staffUserIdx: index("staff_user_roles_staff_user_idx").on(t.staffUserId),
    roleIdx: index("staff_user_roles_role_idx").on(t.roleId),
    clinicIdx: index("staff_user_roles_clinic_idx").on(t.clinicId),
    /**
     * ✅ FIX #1: Two partial unique indexes to handle NULL clinicId correctly.
     *
     * Standard unique(staffUserId, roleId, clinicId) allows duplicate global
     * assignments because NULL != NULL in PostgreSQL unique constraints.
     *
     * Solution:
     *   - Global assignments (clinicId IS NULL): unique on (staffUserId, roleId)
     *   - Clinic assignments (clinicId IS NOT NULL): unique on (staffUserId, roleId, clinicId)
     */
    globalAssignmentUnique: unique("staff_user_roles_global_unique")
      .on(t.staffUserId, t.roleId)
      .nullsNotDistinct(),
    clinicAssignmentUnique: unique("staff_user_roles_clinic_unique")
      .on(t.staffUserId, t.roleId, t.clinicId)
      .nullsNotDistinct(),
  })
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
export type StaffUserRole = typeof staffUserRoles.$inferSelect;
export type NewStaffUserRole = typeof staffUserRoles.$inferInsert;
export type PermissionCategory = (typeof permissionCategoryEnum.enumValues)[number];
