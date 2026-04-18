import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UnauthorizedError } from "./errors.js";

/**
 * JWT Payload with RBAC
 * 
 * Contains all user context needed for authorization:
 * - userId: User identifier
 * - clinicId: Tenant identifier (for multi-tenant isolation)
 * - email: User email
 * - roles: Array of role names (for display/logging)
 * - permissions: Array of permission keys (for authorization)
 * - permissionsVersion: Incremented when roles/permissions change (for cache invalidation)
 */
export interface JwtPayload {
  userId: string;
  clinicId: string;
  email: string;
  roles: string[];
  permissions: string[];
  permissionsVersion: number;
  iat?: number;
  exp?: number;
}

/**
 * Signs a short-lived access token (JWT).
 * Refresh tokens are opaque random strings stored in the DB — not JWTs.
 */
export const signAccessToken = (
  payload: Omit<JwtPayload, "iat" | "exp">
): string =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

/**
 * Verifies an access token and returns its payload.
 * Throws UnauthorizedError on invalid/expired token.
 */
export const verifyAccessToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
};

// verifyRefreshToken is no longer needed — refresh tokens are opaque DB lookups.
// Keeping this export so existing imports don't break during migration.
export const verifyRefreshToken = (_token: string): never => {
  throw new Error(
    "verifyRefreshToken is deprecated. Refresh tokens are now validated via DB lookup in authRepository."
  );
};
