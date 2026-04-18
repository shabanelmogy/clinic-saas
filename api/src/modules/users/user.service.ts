import bcrypt from "bcrypt";
import { db } from "../../db/index.js";
import { userRepository } from "./user.repository.js";
import { appointmentRepository } from "../appointments/appointment.repository.js";
import { authRepository } from "../auth/auth.repository.js";
import type { CreateUserInput, UpdateUserInput, ListUsersQuery } from "./user.validation.js";
import type { User } from "./user.schema.js";
import { NotFoundError, ConflictError, BadRequestError, ForbiddenError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

/**
 * Translation function type
 */
type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

const BCRYPT_ROUNDS = 12;

const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, BCRYPT_ROUNDS);

const sanitizeUser = (user: User): Omit<User, "passwordHash"> => {
  const { passwordHash: _omit, ...safe } = user;
  return safe;
};

/**
 * Service-level permission check.
 * Throws ForbiddenError if user lacks permission.
 */
const requirePermission = (
  userPermissions: string[],
  permission: string,
  t: TranslateFn
): void => {
  if (!userPermissions.includes(permission)) {
    throw new ForbiddenError(t("permissions.required", { permission }));
  }
};

export const userService = {
  /**
   * List users — global, no clinic filter.
   * Requires permissions check.
   */
  async listUsers(
    query: ListUsersQuery,
    requestingUserId: string,
    requestingUserPermissions: string[],
    t: TranslateFn
  ) {
    requirePermission(requestingUserPermissions, "users:view", t);

    const { data, total } = await userRepository.findAll(query);

    logger.info({
      msg: "Users listed",
      requestingUserId,
      count: data.length,
      total,
    });

    return {
      data: data.map(sanitizeUser),
      total,
      page: query.page,
      limit: query.limit,
    };
  },

  /**
   * Get user by ID — global lookup.
   * Users can view their own profile, or need users:view permission.
   */
  async getUserById(
    id: string,
    requestingUserId: string,
    requestingUserPermissions: string[],
    t: TranslateFn
  ) {
    const isOwnProfile = id === requestingUserId;
    if (!isOwnProfile) {
      requirePermission(requestingUserPermissions, "users:view", t);
    }

    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError(t("users.notFound"));

    return sanitizeUser(user);
  },

  /**
   * Create user — global, no clinic scope.
   * Email is globally unique.
   */
  async createUser(
    input: CreateUserInput,
    requestingUserId: string,
    requestingUserPermissions: string[],
    t: TranslateFn
  ) {
    requirePermission(requestingUserPermissions, "users:create", t);

    const normalizedEmail = input.email.toLowerCase();

    // Check for duplicate email — globally unique
    const existing = await userRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictError(t("users.emailExists"));
    }

    const user = await userRepository.create({
      name: input.name,
      email: normalizedEmail,
      passwordHash: await hashPassword(input.password),
      phone: input.phone,
    });

    logger.info({
      msg: "User created",
      userId: user.id,
      email: user.email,
      createdBy: requestingUserId,
    });

    return sanitizeUser(user);
  },

  /**
   * Update user — global, no clinic scope.
   */
  async updateUser(
    id: string,
    input: UpdateUserInput,
    requestingUserId: string,
    requestingUserPermissions: string[],
    t: TranslateFn
  ) {
    const isOwnProfile = id === requestingUserId;

    if (!isOwnProfile) {
      requirePermission(requestingUserPermissions, "users:update", t);
    }

    const existing = await userRepository.findById(id);
    if (!existing) throw new NotFoundError(t("users.notFound"));

    // Check email uniqueness if changing email
    if (input.email && input.email.toLowerCase() !== existing.email) {
      const normalizedEmail = input.email.toLowerCase();
      const emailTaken = await userRepository.findByEmail(normalizedEmail);
      if (emailTaken) throw new ConflictError(t("users.emailInUse"));
    }

    const updateData: Partial<typeof existing> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.email !== undefined) updateData.email = input.email.toLowerCase();
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.password !== undefined) {
      updateData.passwordHash = await hashPassword(input.password);
    }

    const updated = await userRepository.update(id, updateData);
    if (!updated) throw new NotFoundError(t("users.notFound"));

    logger.info({
      msg: "User updated",
      userId: id,
      updatedBy: requestingUserId,
      fields: Object.keys(updateData),
    });

    return sanitizeUser(updated);
  },

  /**
   * Delete user — global, no clinic scope.
   * Validates dependencies (appointments).
   */
  async deleteUser(
    id: string,
    requestingUserId: string,
    requestingUserPermissions: string[],
    t: TranslateFn
  ): Promise<void> {
    requirePermission(requestingUserPermissions, "users:delete", t);

    if (id === requestingUserId) {
      throw new BadRequestError(t("users.cannotDeleteSelf"));
    }

    const existing = await userRepository.findById(id);
    if (!existing) throw new NotFoundError(t("users.notFound"));

    // Check if user has appointments (across all clinics)
    const appointmentCount = await appointmentRepository.countByPatientId(id);
    if (appointmentCount > 0) {
      throw new BadRequestError(t("users.hasAppointments", { count: appointmentCount }));
    }

    await db.transaction(async () => {
      await authRepository.deleteAllForUser(id);
      const deleted = await userRepository.delete(id);
      if (!deleted) throw new NotFoundError(t("users.notFound"));
    });

    logger.warn({
      msg: "User deleted",
      userId: id,
      email: existing.email,
      deletedBy: requestingUserId,
    });
  },

  /**
   * Update user password.
   */
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

    const existing = await userRepository.findById(id);
    if (!existing) throw new NotFoundError(t("users.notFound"));

    if (isOwnProfile) {
      const isValid = await bcrypt.compare(oldPassword, existing.passwordHash);
      if (!isValid) {
        throw new BadRequestError(t("users.incorrectPassword"));
      }
    }

    const passwordHash = await hashPassword(newPassword);
    await userRepository.update(id, { passwordHash });

    logger.info({
      msg: "Password updated",
      userId: id,
      updatedBy: requestingUserId,
    });
  },
};
