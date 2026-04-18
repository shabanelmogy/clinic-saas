import { eq, and, inArray, isNull, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  users,
  roles,
  permissions,
  userRoles,
  rolePermissions,
  type User,
  type Role,
  type Permission,
} from "./rbac.schema.js";

export const rbacRepository = {
  /**
   * Get user with all roles and permissions.
   * Used during login to build JWT payload.
   *
   * For patients: returns global roles (clinicId = null on the role).
   * For staff:    returns global + clinic-specific roles for their clinic.
   */
  async getUserWithRolesAndPermissions(
    userId: string,
    clinicId?: string
  ): Promise<{
    user: User;
    roles: Role[];
    permissions: Permission[];
  } | null> {
    // 1. Get user — global lookup, no clinic filter
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return null;

    // 2. Get all user's roles
    //    - If clinicId provided (staff): include global + clinic-specific roles
    //    - If no clinicId (patient): include only global roles
    const roleCondition = clinicId
      ? and(
          eq(userRoles.userId, userId),
          or(isNull(roles.clinicId), eq(roles.clinicId, clinicId))
        )
      : and(eq(userRoles.userId, userId), isNull(roles.clinicId));

    const userRoleRecords = await db
      .select({ role: roles })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(roleCondition);

    const userRolesList = userRoleRecords.map((r) => r.role);

    if (userRolesList.length === 0) {
      return { user, roles: [], permissions: [] };
    }

    // 3. Get all permissions from all roles (deduplicated)
    const roleIds = userRolesList.map((r) => r.id);

    const permissionRecords = await db
      .select({ permission: permissions })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(inArray(rolePermissions.roleId, roleIds));

    const uniquePermissions = Array.from(
      new Map(
        permissionRecords.map((p) => [p.permission.key, p.permission])
      ).values()
    );

    return { user, roles: userRolesList, permissions: uniquePermissions };
  },

  /**
   * Find user by email — globally unique, no clinic filter.
   */
  async findUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return user;
  },

  /**
   * Assign role to user.
   * clinicId is optional — null means a global role assignment (e.g. Patient).
   */
  async assignRoleToUser(
    userId: string,
    roleId: string,
    assignedBy: string,
    clinicId?: string
  ): Promise<void> {
    const [role] = await db
      .select()
      .from(roles)
      .where(
        and(
          eq(roles.id, roleId),
          clinicId
            ? or(isNull(roles.clinicId), eq(roles.clinicId, clinicId))
            : isNull(roles.clinicId)
        )
      )
      .limit(1);

    if (!role) {
      throw new Error("Role not found or not accessible");
    }

    await db
      .insert(userRoles)
      .values({ userId, roleId, clinicId: clinicId ?? null, assignedBy })
      .onConflictDoNothing();
  },

  /**
   * Remove role from user.
   */
  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    await db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));
  },

  /**
   * Get all roles accessible in a clinic (global + clinic-specific).
   */
  async getRolesForClinic(clinicId: string): Promise<Role[]> {
    return db
      .select()
      .from(roles)
      .where(or(isNull(roles.clinicId), eq(roles.clinicId, clinicId)))
      .orderBy(roles.name);
  },

  /**
   * Get global roles only (for patient role assignment).
   */
  async getGlobalRoles(): Promise<Role[]> {
    return db
      .select()
      .from(roles)
      .where(isNull(roles.clinicId))
      .orderBy(roles.name);
  },

  /**
   * Create a clinic-specific role.
   */
  async createRole(
    name: string,
    description: string | undefined,
    clinicId: string,
    permissionIds: string[]
  ): Promise<Role> {
    const [role] = await db
      .insert(roles)
      .values({ name, description, clinicId })
      .returning();

    if (permissionIds.length > 0) {
      await db.insert(rolePermissions).values(
        permissionIds.map((permId) => ({ roleId: role.id, permissionId: permId }))
      );
    }

    return role;
  },

  /**
   * Update role permissions (clinic-specific roles only).
   */
  async updateRolePermissions(
    roleId: string,
    clinicId: string,
    permissionIds: string[]
  ): Promise<void> {
    const [role] = await db
      .select()
      .from(roles)
      .where(and(eq(roles.id, roleId), eq(roles.clinicId, clinicId)))
      .limit(1);

    if (!role) throw new Error("Role not found or cannot be modified");

    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

    if (permissionIds.length > 0) {
      await db.insert(rolePermissions).values(
        permissionIds.map((permId) => ({ roleId, permissionId: permId }))
      );
    }
  },

  /**
   * Get all permissions (for role management UI).
   */
  async getAllPermissions(): Promise<Permission[]> {
    return db
      .select()
      .from(permissions)
      .orderBy(permissions.category, permissions.name);
  },

  /**
   * Get permissions for a specific role.
   */
  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const records = await db
      .select({ permission: permissions })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));

    return records.map((r) => r.permission);
  },
};
