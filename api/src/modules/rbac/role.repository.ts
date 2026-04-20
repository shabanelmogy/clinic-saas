import { eq, and, or, isNull, ilike, count, inArray, SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  roles,
  permissions,
  rolePermissions,
  staffUserRoles,
  type Role,
  type Permission,
  type NewRole,
} from "./rbac.schema.js";
import { staffUsers } from "../staff-users/staff-user.schema.js";
import { clinics } from "../clinics/clinic.schema.js";
import type { ListRolesQuery } from "./role.validation.js";

export const roleRepository = {
  /**
   * List roles accessible to a clinic — includes global roles (clinicId IS NULL)
   * and clinic-specific roles for the given clinicId.
   * Super admins (no clinicId) see only global roles.
   */
  async findAll(
    query: ListRolesQuery,
    clinicId?: string
  ): Promise<{ data: Role[]; total: number }> {
    const { page, limit, search } = query;
    const offset = (page - 1) * limit;

    const scopeCondition = clinicId
      ? or(isNull(roles.clinicId), eq(roles.clinicId, clinicId))
      : isNull(roles.clinicId);

    const conditions: SQL[] = [scopeCondition!];
    if (search) conditions.push(ilike(roles.name, `%${search}%`));

    const where = and(...conditions);

    const [data, [{ value: total }]] = await Promise.all([
      db.select().from(roles).where(where).limit(limit).offset(offset).orderBy(roles.name),
      db.select({ value: count() }).from(roles).where(where),
    ]);

    return { data, total: Number(total) };
  },

  /**
   * Find a single role by ID.
   * Clinic staff can only access global roles or their own clinic's roles.
   */
  async findById(id: string, clinicId?: string): Promise<Role | undefined> {
    const scopeCondition = clinicId
      ? or(isNull(roles.clinicId), eq(roles.clinicId, clinicId))
      : isNull(roles.clinicId);

    const [role] = await db
      .select()
      .from(roles)
      .where(and(eq(roles.id, id), scopeCondition));
    return role;
  },

  /**
   * Find a role by name within the same scope (global or clinic).
   * Used for duplicate name checks.
   */
  async findByName(name: string, clinicId?: string): Promise<Role | undefined> {
    const scopeCondition = clinicId
      ? eq(roles.clinicId, clinicId)
      : isNull(roles.clinicId);

    const [role] = await db
      .select()
      .from(roles)
      .where(and(eq(roles.name, name), scopeCondition));
    return role;
  },

  /**
   * Create a role and optionally assign permissions in one transaction.
   */
  async create(
    data: Pick<NewRole, "name" | "description" | "clinicId">,
    permissionIds: string[]
  ): Promise<Role> {
    return db.transaction(async (tx) => {
      const [role] = await tx.insert(roles).values(data).returning();

      if (permissionIds.length > 0) {
        await tx.insert(rolePermissions).values(
          permissionIds.map((permissionId) => ({ roleId: role.id, permissionId }))
        );
      }

      return role;
    });
  },

  /**
   * Update role name/description.
   * Only clinic-owned roles can be updated (global roles are system-managed).
   */
  async update(
    id: string,
    data: Partial<Pick<NewRole, "name" | "description">>,
    clinicId: string
  ): Promise<Role | undefined> {
    const [role] = await db
      .update(roles)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(roles.id, id), eq(roles.clinicId, clinicId)))
      .returning();
    return role;
  },

  /**
   * Replace all permissions for a role atomically.
   * Only clinic-owned roles can be modified.
   */
  async updatePermissions(
    id: string,
    permissionIds: string[],
    clinicId: string
  ): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [role] = await tx
        .select()
        .from(roles)
        .where(and(eq(roles.id, id), eq(roles.clinicId, clinicId)))
        .limit(1);

      if (!role) return false;

      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));

      if (permissionIds.length > 0) {
        await tx.insert(rolePermissions).values(
          permissionIds.map((permissionId) => ({ roleId: id, permissionId }))
        );
      }

      return true;
    });
  },

  /**
   * Delete a clinic-owned role.
   * Fails if the role is still assigned to any staff user.
   */
  async delete(id: string, clinicId: string): Promise<boolean> {
    const result = await db
      .delete(roles)
      .where(and(eq(roles.id, id), eq(roles.clinicId, clinicId)))
      .returning();
    return result.length > 0;
  },

  /**
   * Count how many staff users are assigned this role.
   * Used before deletion to prevent orphaned assignments.
   */
  async countAssignments(roleId: string): Promise<number> {
    const [{ value }] = await db
      .select({ value: count() })
      .from(staffUserRoles)
      .where(eq(staffUserRoles.roleId, roleId));
    return Number(value);
  },

  /**
   * Get all permissions for a role.
   */
  async getPermissions(roleId: string): Promise<Permission[]> {
    const records = await db
      .select({ permission: permissions })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));
    return records.map((r) => r.permission);
  },

  /**
   * Get all available permissions, grouped by category.
   */
  async getAllPermissions(): Promise<Permission[]> {
    return db
      .select()
      .from(permissions)
      .orderBy(permissions.category, permissions.name);
  },

  /**
   * Validate that all given permission IDs exist.
   * Returns the IDs that were NOT found.
   */
  async findMissingPermissionIds(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const found = await db
      .select({ id: permissions.id })
      .from(permissions)
      .where(inArray(permissions.id, ids));
    const foundIds = new Set(found.map((p) => p.id));
    return ids.filter((id) => !foundIds.has(id));
  },

  /**
   * Assign a role to a staff user.
   * clinicId = undefined → global assignment.
   */
  async assignRole(
    staffUserId: string,
    roleId: string,
    assignedBy: string,
    clinicId?: string
  ): Promise<void> {
    await db
      .insert(staffUserRoles)
      .values({ staffUserId, roleId, clinicId: clinicId ?? null, assignedBy })
      .onConflictDoNothing();
  },

  /**
   * Remove a role assignment from a staff user.
   */
  async removeRole(staffUserId: string, roleId: string): Promise<boolean> {
    const result = await db
      .delete(staffUserRoles)
      .where(
        and(
          eq(staffUserRoles.staffUserId, staffUserId),
          eq(staffUserRoles.roleId, roleId)
        )
      )
      .returning();
    return result.length > 0;
  },

  /**
   * List all role assignments with staff user, role, and clinic names joined.
   * Used by the super admin assignment management page.
   */
  async listAssignments(params: { page: number; limit: number; staffUserId?: string }) {
    const { page, limit, staffUserId } = params;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (staffUserId) conditions.push(eq(staffUserRoles.staffUserId, staffUserId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, [{ value: total }]] = await Promise.all([
      db
        .select({
          id:            staffUserRoles.id,
          staffUserId:   staffUserRoles.staffUserId,
          staffUserName: staffUsers.name,
          staffUserEmail: staffUsers.email,
          roleId:        staffUserRoles.roleId,
          roleName:      roles.name,
          clinicId:      staffUserRoles.clinicId,
          clinicName:    clinics.name,
          assignedAt:    staffUserRoles.assignedAt,
        })
        .from(staffUserRoles)
        .innerJoin(staffUsers, eq(staffUserRoles.staffUserId, staffUsers.id))
        .innerJoin(roles, eq(staffUserRoles.roleId, roles.id))
        .leftJoin(clinics, eq(staffUserRoles.clinicId, clinics.id))
        .where(where)
        .orderBy(staffUserRoles.assignedAt)
        .limit(limit)
        .offset(offset),
      db
        .select({ value: count() })
        .from(staffUserRoles)
        .where(where),
    ]);

    return { data, total: Number(total) };
  },
};
