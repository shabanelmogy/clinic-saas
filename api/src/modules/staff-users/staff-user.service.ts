import bcrypt from "bcrypt";
import { staffUserRepository } from "./staff-user.repository.js";
import { authRepository } from "../auth/auth.repository.js";
import type { CreateStaffUserInput, UpdateStaffUserInput, ListStaffUsersQuery } from "./staff-user.validation.js";
import type { StaffUser } from "./staff-user.schema.js";
import { NotFoundError, ConflictError, BadRequestError, ForbiddenError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

const BCRYPT_ROUNDS = 12;

const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, BCRYPT_ROUNDS);

const sanitizeStaffUser = (staffUser: StaffUser): Omit<StaffUser, "passwordHash"> => {
  const { passwordHash: _omit, ...safe } = staffUser;
  return safe;
};

const requirePermission = (perms: string[], permission: string, t: TranslateFn): void => {
  if (!perms.includes(permission)) {
    throw new ForbiddenError(t("permissions.required", { permission }));
  }
};

export const staffUserService = {
  async listStaffUsers(
    query: ListStaffUsersQuery,
    requestingUserId: string,
    requestingUserPermissions: string[],
    t: TranslateFn
  ) {
    requirePermission(requestingUserPermissions, "users:view", t);

    const { data, total } = await staffUserRepository.findAll(query);

    logger.info({ msg: "Staff users listed", requestingUserId, count: data.length, total });

    return { data: data.map(sanitizeStaffUser), total, page: query.page, limit: query.limit };
  },

  async getStaffUserById(
    id: string,
    requestingUserId: string,
    requestingUserPermissions: string[],
    t: TranslateFn
  ) {
    const isOwnProfile = id === requestingUserId;
    if (!isOwnProfile) {
      requirePermission(requestingUserPermissions, "users:view", t);
    }

    const staffUser = await staffUserRepository.findById(id);
    if (!staffUser) throw new NotFoundError(t("staffUsers.notFound"));

    return sanitizeStaffUser(staffUser);
  },

  async createStaffUser(
    input: CreateStaffUserInput,
    requestingUserId: string,
    requestingUserPermissions: string[],
    t: TranslateFn
  ) {
    requirePermission(requestingUserPermissions, "users:create", t);

    const existing = await staffUserRepository.findByEmail(input.email);
    if (existing) throw new ConflictError(t("staffUsers.emailExists"));

    const staffUser = await staffUserRepository.create({
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash: await hashPassword(input.password),
      phone: input.phone,
    });

    logger.info({ msg: "Staff user created", staffUserId: staffUser.id, createdBy: requestingUserId });

    return sanitizeStaffUser(staffUser);
  },

  async updateStaffUser(
    id: string,
    input: UpdateStaffUserInput,
    requestingUserId: string,
    requestingUserPermissions: string[],
    t: TranslateFn
  ) {
    const isOwnProfile = id === requestingUserId;
    if (!isOwnProfile) {
      requirePermission(requestingUserPermissions, "users:update", t);
    }

    const existing = await staffUserRepository.findById(id);
    if (!existing) throw new NotFoundError(t("staffUsers.notFound"));

    if (input.email && input.email.toLowerCase() !== existing.email) {
      const taken = await staffUserRepository.findByEmail(input.email);
      if (taken) throw new ConflictError(t("staffUsers.emailInUse"));
    }

    const updateData: Partial<StaffUser> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.email !== undefined) updateData.email = input.email.toLowerCase();
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.password !== undefined) updateData.passwordHash = await hashPassword(input.password);

    const updated = await staffUserRepository.update(id, updateData);
    if (!updated) throw new NotFoundError(t("staffUsers.notFound"));

    logger.info({ msg: "Staff user updated", staffUserId: id, updatedBy: requestingUserId });

    return sanitizeStaffUser(updated);
  },

  async deleteStaffUser(
    id: string,
    requestingUserId: string,
    requestingUserPermissions: string[],
    t: TranslateFn
  ): Promise<void> {
    requirePermission(requestingUserPermissions, "users:delete", t);

    if (id === requestingUserId) {
      throw new BadRequestError(t("staffUsers.cannotDeleteSelf"));
    }

    const existing = await staffUserRepository.findById(id);
    if (!existing) throw new NotFoundError(t("staffUsers.notFound"));

    // Revoke all active sessions before soft-deleting
    await authRepository.revokeAllForUser(id);

    const deleted = await staffUserRepository.softDelete(id);
    if (!deleted) throw new NotFoundError(t("staffUsers.notFound"));

    logger.warn({ msg: "Staff user soft-deleted", staffUserId: id, deletedBy: requestingUserId });
  },

  async updatePassword(
    id: string,
    oldPassword: string,
    newPassword: string,
    requestingUserId: string,
    requestingUserPermissions: string[],
    t: TranslateFn
  ): Promise<void> {
    const isOwnProfile = id === requestingUserId;
    if (!isOwnProfile) {
      requirePermission(requestingUserPermissions, "users:update", t);
    }

    const existing = await staffUserRepository.findById(id);
    if (!existing) throw new NotFoundError(t("staffUsers.notFound"));

    if (isOwnProfile) {
      const isValid = await bcrypt.compare(oldPassword, existing.passwordHash);
      if (!isValid) throw new BadRequestError(t("staffUsers.incorrectPassword"));
    }

    await staffUserRepository.update(id, { passwordHash: await hashPassword(newPassword) });

    logger.info({ msg: "Staff user password updated", staffUserId: id, updatedBy: requestingUserId });
  },
};
