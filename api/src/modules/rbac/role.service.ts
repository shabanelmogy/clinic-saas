import { roleRepository } from "./role.repository.js";
import { staffUserRepository } from "../staff-users/staff-user.repository.js";
import type { CreateRoleInput, UpdateRoleInput, ListRolesQuery, AssignRoleInput, RemoveRoleInput } from "./role.validation.js";
import { NotFoundError, ConflictError, BadRequestError, ForbiddenError } from "../../utils/errors.js";
import { requirePermission } from "./authorize.middleware.js";
import { logger } from "../../utils/logger.js";
import type { TranslateFn } from "../../utils/i18n.js";

export const roleService = {
  /**
   * List roles.
   * Clinic staff see global + their clinic's roles.
   * Super admins (no clinicId) see only global roles.
   */
  async listRoles(
    query: ListRolesQuery,
    context: { userId: string; clinicId?: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "roles:view", t);

    const { data, total } = await roleRepository.findAll(query, context.clinicId);

    logger.info({ msg: "Roles listed", userId: context.userId, clinicId: context.clinicId, count: data.length });

    return { data, total, page: query.page, limit: query.limit };
  },

  /**
   * Get a single role with its permissions.
   */
  async getRoleById(
    id: string,
    context: { userId: string; clinicId?: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "roles:view", t);

    const role = await roleRepository.findById(id, context.clinicId);
    if (!role) throw new NotFoundError(t("roles.notFound"));

    const rolePermissions = await roleRepository.getPermissions(id);

    return { ...role, permissions: rolePermissions };
  },

  /**
   * Create a clinic-scoped role.
   * Only clinic staff can create roles — super admins manage global roles via seeding.
   */
  async createRole(
    input: CreateRoleInput,
    context: { userId: string; clinicId?: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "roles:create", t);

    if (!context.clinicId) {
      throw new ForbiddenError(t("roles.globalRolesReadOnly"));
    }

    // Duplicate name check within the same scope
    const existing = await roleRepository.findByName(input.name, context.clinicId);
    if (existing) throw new ConflictError(t("roles.nameExists"));

    // Validate all permission IDs exist
    if (input.permissionIds.length > 0) {
      const missing = await roleRepository.findMissingPermissionIds(input.permissionIds);
      if (missing.length > 0) {
        throw new BadRequestError(t("roles.invalidPermissions"));
      }
    }

    const role = await roleRepository.create(
      { name: input.name, description: input.description, clinicId: context.clinicId },
      input.permissionIds
    );

    logger.info({ msg: "Role created", roleId: role.id, clinicId: context.clinicId, createdBy: context.userId });

    return role;
  },

  /**
   * Update a clinic-scoped role's name/description and/or permissions.
   * Global roles are read-only.
   */
  async updateRole(
    id: string,
    input: UpdateRoleInput,
    context: { userId: string; clinicId?: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "roles:update", t);

    if (!context.clinicId) {
      throw new ForbiddenError(t("roles.globalRolesReadOnly"));
    }

    const role = await roleRepository.findById(id, context.clinicId);
    if (!role) throw new NotFoundError(t("roles.notFound"));

    // Global roles cannot be modified
    if (!role.clinicId) throw new ForbiddenError(t("roles.globalRolesReadOnly"));

    // Check for name conflict if name is being changed
    if (input.name && input.name !== role.name) {
      const taken = await roleRepository.findByName(input.name, context.clinicId);
      if (taken) throw new ConflictError(t("roles.nameExists"));
    }

    // Validate permission IDs if provided
    if (input.permissionIds !== undefined && input.permissionIds.length > 0) {
      const missing = await roleRepository.findMissingPermissionIds(input.permissionIds);
      if (missing.length > 0) {
        throw new BadRequestError(t("roles.invalidPermissions"));
      }
    }

    // Update name/description if provided
    const nameOrDescChanged = input.name !== undefined || input.description !== undefined;
    if (nameOrDescChanged) {
      await roleRepository.update(
        id,
        { name: input.name, description: input.description },
        context.clinicId
      );
    }

    // Replace permissions if provided
    if (input.permissionIds !== undefined) {
      await roleRepository.updatePermissions(id, input.permissionIds, context.clinicId);
    }

    const updated = await roleRepository.findById(id, context.clinicId);
    const updatedPermissions = await roleRepository.getPermissions(id);

    logger.info({ msg: "Role updated", roleId: id, clinicId: context.clinicId, updatedBy: context.userId });

    return { ...updated!, permissions: updatedPermissions };
  },

  /**
   * Delete a clinic-scoped role.
   * Blocked if the role is still assigned to any staff user.
   * Global roles cannot be deleted.
   */
  async deleteRole(
    id: string,
    context: { userId: string; clinicId?: string; permissions: string[] },
    t: TranslateFn
  ): Promise<void> {
    requirePermission(context.permissions, "roles:delete", t);

    if (!context.clinicId) {
      throw new ForbiddenError(t("roles.globalRolesReadOnly"));
    }

    const role = await roleRepository.findById(id, context.clinicId);
    if (!role) throw new NotFoundError(t("roles.notFound"));

    if (!role.clinicId) throw new ForbiddenError(t("roles.globalRolesReadOnly"));

    const assignmentCount = await roleRepository.countAssignments(id);
    if (assignmentCount > 0) {
      throw new BadRequestError(t("roles.cannotDeleteInUse", { count: assignmentCount }));
    }

    await roleRepository.delete(id, context.clinicId);

    logger.warn({ msg: "Role deleted", roleId: id, clinicId: context.clinicId, deletedBy: context.userId });
  },

  /**
   * List all available permissions (for building role assignment UIs).
   */
  async listPermissions(
    context: { userId: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "roles:view", t);

    const data = await roleRepository.getAllPermissions();

    return data;
  },

  /**
   * Assign a role to a staff user.
   * Super admins can pass clinicId in body to scope the assignment.
   * Clinic staff always use their JWT clinicId.
   */
  async assignRole(
    input: AssignRoleInput,
    context: { userId: string; clinicId?: string; permissions: string[] },
    t: TranslateFn
  ): Promise<void> {
    requirePermission(context.permissions, "users:manage_roles", t);

    // Super admin can pass clinicId explicitly; clinic staff use JWT clinicId
    const effectiveClinicId = context.clinicId ?? input.clinicId;

    // Verify the staff user exists
    const staffUser = await staffUserRepository.findById(input.staffUserId);
    if (!staffUser) throw new NotFoundError(t("staffUsers.notFound"));

    // Verify the role is accessible in this scope
    const role = await roleRepository.findById(input.roleId, effectiveClinicId);
    if (!role) throw new NotFoundError(t("roles.notFound"));

    await roleRepository.assignRole(input.staffUserId, input.roleId, context.userId, effectiveClinicId);

    logger.info({
      msg: "Role assigned to staff user",
      staffUserId: input.staffUserId,
      roleId: input.roleId,
      clinicId: effectiveClinicId,
      assignedBy: context.userId,
    });
  },

  /**
   * Remove a role from a staff user.
   */
  async removeRole(
    input: RemoveRoleInput,
    context: { userId: string; clinicId?: string; permissions: string[] },
    t: TranslateFn
  ): Promise<void> {
    requirePermission(context.permissions, "users:manage_roles", t);

    const removed = await roleRepository.removeRole(input.staffUserId, input.roleId);
    if (!removed) throw new NotFoundError(t("roles.assignmentNotFound"));

    logger.info({
      msg: "Role removed from staff user",
      staffUserId: input.staffUserId,
      roleId: input.roleId,
      clinicId: context.clinicId,
      removedBy: context.userId,
    });
  },

  /**
   * List all role assignments (super admin only).
   * Shows staff user, role, and clinic for each assignment.
   */
  async listAssignments(
    query: { page: number; limit: number; staffUserId?: string },
    context: { userId: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "users:manage_roles", t);

    const { data, total } = await roleRepository.listAssignments(query);

    logger.info({ msg: "Role assignments listed", userId: context.userId, count: data.length });

    return { data, total, page: query.page, limit: query.limit };
  },
};
