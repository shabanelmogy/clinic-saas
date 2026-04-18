import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type JwtPayloadRBAC } from "./jwt-rbac.js";
import { sendError } from "../../utils/response.js";
import { ForbiddenError, UnauthorizedError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

// Extend Express Request to carry RBAC user context
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayloadRBAC;
      clinicId?: string;
    }
  }
}

/**
 * Authenticate middleware
 * 
 * Verifies JWT and attaches user context to request.
 * Does NOT check permissions - use authorize() for that.
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    sendError(res, req.t("auth.invalidToken"), 401);
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    req.clinicId = payload.clinicId;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      sendError(res, err.message, 401);
    } else {
      next(err);
    }
  }
};

/**
 * Permission-based authorization middleware
 * 
 * Checks if user has required permission.
 * Permissions are read from JWT (no database query).
 * 
 * Usage:
 *   router.post("/users", authenticate, authorize("users:create"), controller.create)
 *   router.delete("/users/:id", authenticate, authorize("users:delete"), controller.delete)
 * 
 * @param permission - Permission key (e.g., "users:create")
 */
export const authorize = (permission: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, req.t("common.unauthorized"), 401);
      return;
    }

    // Check if user has the required permission
    if (!req.user.permissions.includes(permission)) {
      const err = new ForbiddenError(
        req.t("permissions.required", { permission })
      );

      logger.warn({
        msg: "Authorization failed - insufficient permission",
        userId: req.user.userId,
        clinicId: req.user.clinicId,
        userPermissions: req.user.permissions,
        requiredPermission: permission,
        path: req.path,
        method: req.method,
      });

      sendError(res, err.message, 403);
      return;
    }

    next();
  };

/**
 * Require ANY of the specified permissions
 * 
 * Usage:
 *   router.get("/appointments", authenticate, authorizeAny([
 *     "appointments:view_all",
 *     "appointments:view_own"
 *   ]), controller.list)
 */
export const authorizeAny = (permissions: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, req.t("common.unauthorized"), 401);
      return;
    }

    const hasAny = permissions.some((perm) =>
      req.user!.permissions.includes(perm)
    );

    if (!hasAny) {
      const err = new ForbiddenError(
        req.t("permissions.oneRequired", { permissions: permissions.join(", ") })
      );

      logger.warn({
        msg: "Authorization failed - no matching permission",
        userId: req.user.userId,
        clinicId: req.user.clinicId,
        userPermissions: req.user.permissions,
        requiredPermissions: permissions,
        path: req.path,
        method: req.method,
      });

      sendError(res, err.message, 403);
      return;
    }

    next();
  };

/**
 * Require ALL of the specified permissions
 * 
 * Usage:
 *   router.post("/admin/settings", authenticate, authorizeAll([
 *     "clinic:update",
 *     "system:manage_settings"
 *   ]), controller.updateSettings)
 */
export const authorizeAll = (permissions: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, req.t("common.unauthorized"), 401);
      return;
    }

    const hasAll = permissions.every((perm) =>
      req.user!.permissions.includes(perm)
    );

    if (!hasAll) {
      const missing = permissions.filter(
        (perm) => !req.user!.permissions.includes(perm)
      );

      const err = new ForbiddenError(
        req.t("permissions.missingPermissions", { permissions: missing.join(", ") })
      );

      logger.warn({
        msg: "Authorization failed - missing permissions",
        userId: req.user.userId,
        clinicId: req.user.clinicId,
        userPermissions: req.user.permissions,
        requiredPermissions: permissions,
        missingPermissions: missing,
        path: req.path,
        method: req.method,
      });

      sendError(res, err.message, 403);
      return;
    }

    next();
  };

/**
 * Helper function for service-level permission checks
 * 
 * Use this inside services when you need to check permissions programmatically.
 * 
 * Usage:
 *   requirePermission(req.user, "users:delete", req.t);
 */
export const requirePermission = (
  user: JwtPayloadRBAC | undefined,
  permission: string,
  t: (key: string, params?: Record<string, string | number>) => string
): void => {
  if (!user) {
    throw new UnauthorizedError(t("common.unauthorized"));
  }

  if (!user.permissions.includes(permission)) {
    throw new ForbiddenError(t("permissions.required", { permission }));
  }
};

/**
 * Check if user has permission (returns boolean)
 * 
 * Use this for conditional logic in services.
 * 
 * Usage:
 *   if (hasPermission(req.user, "appointments:view_all")) {
 *     // Show all appointments
 *   } else {
 *     // Show only own appointments
 *   }
 */
export const hasPermission = (
  user: JwtPayloadRBAC | undefined,
  permission: string
): boolean => {
  return user?.permissions.includes(permission) ?? false;
};
