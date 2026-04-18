import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { userRepository } from "../users/user.repository.js";
import { rbacRepository } from "../rbac/rbac.repository.js";
import { authRepository } from "./auth.repository.js";
import { signAccessToken, generatePermissionsVersion } from "../rbac/jwt-rbac.js";
import { UnauthorizedError } from "../../utils/errors.js";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import type { LoginInput } from "./auth.validation.js";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

/** Parse "7d", "15m" etc. into milliseconds */
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

export const authService = {
  /**
   * Login — global user lookup, no clinicId required.
   *
   * Returns a JWT with userType: "patient" and no clinicId.
   * Clinic staff login is handled separately (future: staff auth endpoint).
   */
  async login(
    input: LoginInput,
    t: TranslateFn,
    meta: { userAgent?: string; ipAddress?: string } = {}
  ) {
    // Find user by email — global lookup
    const user = await userRepository.findByEmail(input.email);

    // Constant-time comparison — always run bcrypt to prevent timing attacks
    const dummyHash = "$2b$12$invalidhashfortimingattackprevention000000000000000000";
    const passwordMatch = await bcrypt.compare(
      input.password,
      user?.passwordHash ?? dummyHash
    );

    if (!user || !passwordMatch) {
      throw new UnauthorizedError(t("auth.invalidCredentials"));
    }

    if (!user.isActive) {
      throw new UnauthorizedError(t("auth.accountDeactivated"));
    }

    // Fetch user's global roles and permissions (no clinicId = patient context)
    const rbacData = await rbacRepository.getUserWithRolesAndPermissions(user.id);

    if (!rbacData) {
      throw new UnauthorizedError(t("auth.accountNotFound"));
    }

    const { roles, permissions } = rbacData;

    // ✅ Patient token — no clinicId
    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      userType: "patient",
      roles: roles.map((r) => r.name),
      permissions: permissions.map((p) => p.key),
      permissionsVersion: generatePermissionsVersion(),
    });

    const familyId = randomUUID();
    const refreshToken = await authRepository.create({
      userId: user.id,
      familyId,
      expiresAt: new Date(Date.now() + refreshTokenTtlMs()),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    logger.info({
      msg: "User logged in",
      userId: user.id,
      email: user.email,
      userType: "patient",
      roles: roles.map((r) => r.name),
      permissionCount: permissions.length,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: roles.map((r) => r.name),
      },
    };
  },

  async refresh(
    rawToken: string,
    t: TranslateFn,
    meta: { userAgent?: string; ipAddress?: string } = {}
  ) {
    const stored = await authRepository.findByRawToken(rawToken);

    if (!stored) {
      throw new UnauthorizedError(t("auth.invalidRefreshToken"));
    }

    if (stored.revokedAt !== null) {
      logger.warn({
        msg: "Refresh token reuse detected — revoking entire family",
        userId: stored.userId,
        familyId: stored.familyId,
      });
      await authRepository.revokeFamilyAll(stored.familyId);
      throw new UnauthorizedError(t("auth.refreshTokenReused"));
    }

    if (stored.expiresAt < new Date()) {
      await authRepository.revoke(stored.id);
      throw new UnauthorizedError(t("auth.refreshTokenExpired"));
    }

    // Load user with global roles (patient context)
    const rbacData = await rbacRepository.getUserWithRolesAndPermissions(stored.userId);

    if (!rbacData || !rbacData.user.isActive) {
      await authRepository.revoke(stored.id);
      throw new UnauthorizedError(t("auth.accountNotFound"));
    }

    const { user, roles, permissions } = rbacData;

    await authRepository.revoke(stored.id);

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      userType: "patient",
      roles: roles.map((r) => r.name),
      permissions: permissions.map((p) => p.key),
      permissionsVersion: generatePermissionsVersion(),
    });

    const newRefreshToken = await authRepository.create({
      userId: user.id,
      familyId: stored.familyId,
      expiresAt: new Date(Date.now() + refreshTokenTtlMs()),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    return { accessToken, refreshToken: newRefreshToken };
  },

  async logout(rawToken: string): Promise<void> {
    const stored = await authRepository.findByRawToken(rawToken);
    if (stored) {
      await authRepository.revoke(stored.id);
    }
  },

  async logoutAll(userId: string): Promise<void> {
    await authRepository.revokeAllForUser(userId);
  },
};
