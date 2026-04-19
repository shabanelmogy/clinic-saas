import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { UnauthorizedError } from "../../utils/errors.js";

// ─── JWT Payload ──────────────────────────────────────────────────────────────

/**
 * JWT Payload with RBAC.
 *
 * Staff token (clinic-scoped):
 *   { userType: "staff", userId, clinicId, email, roles, permissions, permissionsVersion }
 *
 * Staff token (global — Super Admin):
 *   { userType: "staff", userId, email, roles, permissions, permissionsVersion }
 *   clinicId is absent — no clinic scope
 */
export interface JwtPayloadRBAC {
  userId: string;
  /** Present for clinic-scoped staff; absent for global admins (Super Admin) */
  clinicId?: string;
  email: string;
  /** Always "staff" — patients are not system users and do not log in */
  userType: "staff";
  roles: string[];
  permissions: string[];
  /**
   * Timestamp-based version for future stale-permission detection.
   * If a role is revoked, increment this version in the DB.
   * Middleware can compare JWT version vs DB version to force re-login.
   */
  permissionsVersion: number;
  iat?: number;
  exp?: number;
}

// ─── Sign ─────────────────────────────────────────────────────────────────────

export const signAccessToken = (
  payload: Omit<JwtPayloadRBAC, "iat" | "exp">
): string =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

// ─── Verify ───────────────────────────────────────────────────────────────────

export const verifyAccessToken = (token: string): JwtPayloadRBAC => {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayloadRBAC;

    // Runtime guard — reject tokens that don't match expected shape
    if (payload.userType !== "staff") {
      throw new UnauthorizedError("Invalid token type");
    }

    return payload;
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError("Invalid or expired access token");
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a new permissions version (timestamp-based) */
export const generatePermissionsVersion = (): number => Date.now();

/** Check if JWT permissions are stale compared to DB version */
export const arePermissionsStale = (
  jwtVersion: number,
  currentVersion: number
): boolean => jwtVersion < currentVersion;
