import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { UnauthorizedError } from "../../utils/errors.js";

/**
 * JWT Payload with RBAC
 *
 * userType distinguishes patients (global) from clinic staff (tenant-scoped).
 *
 * Patient token:
 *   { userType: "patient", userId, email, permissions: ["appointments:create", ...] }
 *
 * Staff token:
 *   { userType: "staff", userId, clinicId, email, roles, permissions: [...] }
 */
export interface JwtPayloadRBAC {
  userId: string;
  /** Present for staff; absent for patients */
  clinicId?: string;
  email: string;
  /** "patient" = global user | "staff" = clinic employee */
  userType: "patient" | "staff";
  roles: string[];
  permissions: string[];
  permissionsVersion: number;
  iat?: number;
  exp?: number;
}

/**
 * Sign access token with RBAC payload
 */
export const signAccessToken = (
  payload: Omit<JwtPayloadRBAC, "iat" | "exp">
): string =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

/**
 * Verify access token and return RBAC payload
 */
export const verifyAccessToken = (token: string): JwtPayloadRBAC => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayloadRBAC;
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
};

/**
 * Generate new permissions version (timestamp-based)
 */
export const generatePermissionsVersion = (): number => Date.now();

/**
 * Check if permissions are stale
 */
export const arePermissionsStale = (
  jwtVersion: number,
  currentVersion: number
): boolean => jwtVersion < currentVersion;
