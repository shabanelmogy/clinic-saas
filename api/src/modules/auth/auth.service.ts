import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { staffUserRepository } from "../staff-users/staff-user.repository.js";
import { rbacRepository } from "../rbac/rbac.repository.js";
import { authRepository } from "./auth.repository.js";
import { signAccessToken, generatePermissionsVersion } from "../rbac/jwt-rbac.js";
import { UnauthorizedError, BadRequestError } from "../../utils/errors.js";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import type { LoginInput } from "./auth.validation.js";
import type { TranslateFn } from "../../utils/i18n.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse duration strings like "7d", "15m" into milliseconds */
const parseDuration = (duration: string): number => {
  const units: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid duration format: ${duration}`);
  return parseInt(match[1]) * units[match[2]];
};

const refreshTokenTtlMs = () => parseDuration(env.JWT_REFRESH_EXPIRES_IN);

// ─── Service ──────────────────────────────────────────────────────────────────

export const authService = {
  /**
   * Login — staff user lookup with constant-time password comparison.
   *
   * clinicId provided → clinic-scoped token (Doctor, Receptionist, etc.)
   * clinicId absent   → global token (Super Admin)
   */
  async login(
    input: LoginInput,
    t: TranslateFn,
    meta: { userAgent?: string; ipAddress?: string } = {}
  ) {
    const staffUser = await staffUserRepository.findByEmail(input.email);

    // ✅ Constant-time comparison — bcrypt always runs even when user not found
    // This prevents timing attacks that reveal whether an email exists
    const DUMMY_HASH = "$2b$12$invalidhashfortimingattackprevention000000000000000000";
    const passwordMatch = await bcrypt.compare(
      input.password,
      staffUser?.passwordHash ?? DUMMY_HASH
    );

    if (!staffUser || !passwordMatch) {
      throw new UnauthorizedError(t("auth.invalidCredentials"));
    }

    if (!staffUser.isActive || staffUser.deletedAt !== null) {
      throw new UnauthorizedError(t("auth.accountDeactivated"));
    }

    const isClinicScoped = !!input.clinicId;

    // Load roles + permissions from DB — only at login time
    // After this, permissions live in the JWT (no DB hit per request)
    const rbacData = await rbacRepository.getStaffUserWithRolesAndPermissions(
      staffUser.id,
      isClinicScoped ? input.clinicId : undefined
    );

    if (!rbacData) {
      throw new UnauthorizedError(t("auth.accountNotFound"));
    }

    const { roles, permissions } = rbacData;

    const accessToken = signAccessToken({
      userId: staffUser.id,
      email: staffUser.email,
      userType: "staff",
      clinicId: isClinicScoped ? input.clinicId : undefined,
      roles: roles.map((r) => r.name),
      permissions: permissions.map((p) => p.key),
      permissionsVersion: generatePermissionsVersion(),
    });

    const familyId = randomUUID();
    const refreshToken = await authRepository.create({
      staffUserId: staffUser.id,
      familyId,
      expiresAt: new Date(Date.now() + refreshTokenTtlMs()),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    logger.info({
      msg: "Staff user logged in",
      staffUserId: staffUser.id,
      email: staffUser.email,
      clinicId: isClinicScoped ? input.clinicId : undefined,
      roles: roles.map((r) => r.name),
      permissionCount: permissions.length,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: staffUser.id,
        name: staffUser.name,
        email: staffUser.email,
        userType: "staff" as const,
        clinicId: isClinicScoped ? input.clinicId : undefined,
        roles: roles.map((r) => r.name),
      },
    };
  },

  /**
   * Refresh — rotate token and re-issue access token.
   *
   * Preserves the clinicId from the stored token's associated staff user context.
   * Reuse detection: if a revoked token is presented, the entire family is revoked.
   */
  async refresh(
    rawToken: string,
    t: TranslateFn,
    meta: { userAgent?: string; ipAddress?: string } = {}
  ) {
    const stored = await authRepository.findByRawToken(rawToken);

    if (!stored) {
      throw new UnauthorizedError(t("auth.invalidRefreshToken"));
    }

    // ✅ Reuse detection — revoked token presented means stolen token
    if (stored.revokedAt !== null) {
      logger.warn({
        msg: "Refresh token reuse detected — revoking entire family",
        staffUserId: stored.staffUserId,
        familyId: stored.familyId,
        ipAddress: meta.ipAddress,
      });
      await authRepository.revokeFamilyAll(stored.familyId);
      throw new UnauthorizedError(t("auth.refreshTokenReused"));
    }

    if (stored.expiresAt < new Date()) {
      await authRepository.revoke(stored.id);
      throw new UnauthorizedError(t("auth.refreshTokenExpired"));
    }

    // Load fresh roles/permissions — picks up any role changes since last login
    const rbacData = await rbacRepository.getStaffUserWithRolesAndPermissions(
      stored.staffUserId
    );

    if (!rbacData || !rbacData.staffUser.isActive || rbacData.staffUser.deletedAt !== null) {
      await authRepository.revoke(stored.id);
      throw new UnauthorizedError(t("auth.accountNotFound"));
    }

    const { staffUser, roles, permissions } = rbacData;

    // ✅ Revoke old token BEFORE issuing new one — atomic rotation
    await authRepository.revoke(stored.id);

    const accessToken = signAccessToken({
      userId: staffUser.id,
      email: staffUser.email,
      userType: "staff",
      // clinicId is not stored in refresh token — global refresh only
      // For clinic-scoped refresh, client must re-login with clinicId
      roles: roles.map((r) => r.name),
      permissions: permissions.map((p) => p.key),
      permissionsVersion: generatePermissionsVersion(),
    });

    const newRefreshToken = await authRepository.create({
      staffUserId: staffUser.id,
      familyId: stored.familyId, // ✅ Same family — maintains reuse detection chain
      expiresAt: new Date(Date.now() + refreshTokenTtlMs()),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    logger.info({
      msg: "Token refreshed",
      staffUserId: staffUser.id,
      familyId: stored.familyId,
    });

    return { accessToken, refreshToken: newRefreshToken };
  },

  /**
   * Logout — revoke single refresh token.
   * Access token remains valid until expiry (short-lived by design).
   */
  async logout(rawToken: string): Promise<void> {
    const stored = await authRepository.findByRawToken(rawToken);
    if (stored && stored.revokedAt === null) {
      await authRepository.revoke(stored.id);
    }
  },

  /**
   * Logout all — revoke every refresh token for this staff user.
   * Forces re-login on all devices.
   */
  async logoutAll(staffUserId: string): Promise<void> {
    await authRepository.revokeAllForUser(staffUserId);
    logger.info({ msg: "All sessions revoked", staffUserId });
  },

  /**
   * Change password — verifies current password before updating.
   * Revokes all existing sessions after change (security best practice).
   */
  async changePassword(
    staffUserId: string,
    currentPassword: string,
    newPassword: string,
    t: TranslateFn
  ): Promise<void> {
    const staffUser = await staffUserRepository.findById(staffUserId);
    if (!staffUser) throw new UnauthorizedError(t("auth.accountNotFound"));

    const isValid = await bcrypt.compare(currentPassword, staffUser.passwordHash);
    if (!isValid) throw new BadRequestError(t("staffUsers.incorrectPassword"));

    const BCRYPT_ROUNDS = 12;
    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await staffUserRepository.update(staffUserId, { passwordHash: newHash });

    // ✅ Revoke all sessions — forces re-login with new password
    await authRepository.revokeAllForUser(staffUserId);

    logger.info({ msg: "Password changed, all sessions revoked", staffUserId });
  },
};
