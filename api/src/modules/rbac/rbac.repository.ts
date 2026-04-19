import { eq, and, inArray, isNull, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  roles,
  permissions,
  staffUserRoles,
  rolePermissions,
  type Role,
  type Permission,
} from "./rbac.schema.js";
import { staffUsers, type StaffUser } from "../staff-users/staff-user.schema.js";

export const rbacRepository = {
  /**
   * Get staff user with all roles and permissions.
   * Used during login to build JWT payload.
   *
   * No clinicId → global roles only (Super Admin, etc.)
   * With clinicId → global + clinic-specific roles for that clinic
   */
  async getStaffUserWithRolesAndPermissions(
    staffUserId: string,
    clinicId?: string
  ): Promise<{
    staffUser: StaffUser;
    roles: Role[];
    permissions: Permission[];
  } | null> {
    const [staffUser] = await db
      .select()
      .from(staffUsers)
      .where(and(eq(staffUsers.id, staffUserId), isNull(staffUsers.deletedAt)))
      .limit(1);

    if (!staffUser) return null;

    const roleCondition = clinicId
      ? and(
          eq(staffUserRoles.staffUserId, staffUserId),
          or(isNull(roles.clinicId), eq(roles.clinicId, clinicId))
        )
      : and(eq(staffUserRoles.staffUserId, staffUserId), isNull(roles.clinicId));

    const roleRecords = await db
      .select({ role: roles })
      .from(staffUserRoles)
      .innerJoin(roles, eq(staffUserRoles.roleId, roles.id))
      .where(roleCondition);

    const roleList = roleRecords.map((r) => r.role);

    if (roleList.length === 0) {
      return { staffUser, roles: [], permissions: [] };
    }

    const roleIds = roleList.map((r) => r.id);

    const permissionRecords = await db
      .select({ permission: permissions })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(inArray(rolePermissions.roleId, roleIds));

    const uniquePermissions = Array.from(
      new Map(permissionRecords.map((p) => [p.permission.key, p.permission])).values()
    );

    return { staffUser, roles: roleList, permissions: uniquePermissions };
  },

  async assignRoleToStaffUser(
    staffUserId: string,
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

    if (!role) throw new Error("Role not found or not accessible");

    await db
      .insert(staffUserRoles)
      .values({ staffUserId, roleId, clinicId: clinicId ?? null, assignedBy })
      .onConflictDoNothing();
  },

  async removeRoleFromStaffUser(staffUserId: string, roleId: string): Promise<void> {
    await db
      .delete(staffUserRoles)
      .where(and(eq(staffUserRoles.staffUserId, staffUserId), eq(staffUserRoles.roleId, roleId)));
  },

  async getRolesForClinic(clinicId: string): Promise<Role[]> {
    return db
      .select()
      .from(roles)
      .where(or(isNull(roles.clinicId), eq(roles.clinicId, clinicId)))
      .orderBy(roles.name);
  },

  async getGlobalRoles(): Promise<Role[]> {
    return db.select().from(roles).where(isNull(roles.clinicId)).orderBy(roles.name);
  },

  async createRole(
    name: string,
    description: string | undefined,
    clinicId: string,
    permissionIds: string[]
  ): Promise<Role> {
    const [role] = await db.insert(roles).values({ name, description, clinicId }).returning();

    if (permissionIds.length > 0) {
      await db.insert(rolePermissions).values(
        permissionIds.map((permId) => ({ roleId: role.id, permissionId: permId }))
      );
    }

    return role;
  },

  async updateRolePermissions(roleId: string, clinicId: string, permissionIds: string[]): Promise<void> {
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

  async getAllPermissions(): Promise<Permission[]> {
    return db.select().from(permissions).orderBy(permissions.category, permissions.name);
  },

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const records = await db
      .select({ permission: permissions })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));

    return records.map((r) => r.permission);
  },
};
