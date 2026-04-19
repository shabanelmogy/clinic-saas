import type { Request, Response, NextFunction } from "express";
import { type JwtPayloadRBAC } from "./jwt-rbac.js";
import { sendError } from "../../utils/response.js";
import { ForbiddenError, UnauthorizedError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

// ─── Type augmentation (shared with auth.middleware.ts) ───────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayloadRBAC;
      clinicId?: string;
    }
  }
}

// ─── Route-level middleware ───────────────────────────────────────────────────

/**
 * Require a single permission.
 * Reads from JWT — zero DB queries.
 *
 * Usage:
 *   router.post("/", authenticate, authorize("appointments:create"), controller.create)
 */
export const authorize = (permission: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, req.t("common.unauthorized"), 401);
      return;
    }

    if (!req.user.permissions.includes(permission)) {
      logger.warn({
        msg: "Authorization failed — missing permission",
        staffUserId: req.user.userId,
        clinicId: req.user.clinicId,
        required: permission,
        has: req.user.permissions,
        path: req.path,
        method: req.method,
      });
      sendError(res, req.t("permissions.required", { permission }), 403);
      return;
    }

    next();
  };

/**
 * Require ANY of the listed permissions (OR logic).
 *
 * Usage:
 *   router.get("/", authenticate, authorizeAny(["appointments:view_all", "appointments:view_own"]), controller.list)
 */
export const authorizeAny = (required: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, req.t("common.unauthorized"), 401);
      return;
    }

    const hasAny = required.some((p) => req.user!.permissions.includes(p));

    if (!hasAny) {
      logger.warn({
        msg: "Authorization failed — none of required permissions present",
        staffUserId: req.user.userId,
        clinicId: req.user.clinicId,
        required,
        has: req.user.permissions,
        path: req.path,
        method: req.method,
      });
      sendError(res, req.t("permissions.oneRequired", { permissions: required.join(", ") }), 403);
      return;
    }

    next();
  };

/**
 * Require ALL of the listed permissions (AND logic).
 *
 * Usage:
 *   router.post("/admin", authenticate, authorizeAll(["clinic:update", "system:manage_settings"]), controller.admin)
 */
export const authorizeAll = (required: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, req.t("common.unauthorized"), 401);
      return;
    }

    const missing = required.filter((p) => !req.user!.permissions.includes(p));

    if (missing.length > 0) {
      logger.warn({
        msg: "Authorization failed — missing required permissions",
        staffUserId: req.user.userId,
        clinicId: req.user.clinicId,
        required,
        missing,
        path: req.path,
        method: req.method,
      });
      sendError(res, req.t("permissions.missingPermissions", { permissions: missing.join(", ") }), 403);
      return;
    }

    next();
  };

// ─── Service-level helpers ────────────────────────────────────────────────────

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

/**
 * Throws ForbiddenError if the user lacks the permission.
 * Use inside services for programmatic permission checks.
 *
 * Usage:
 *   requirePermission(context.permissions, "users:delete", t);
 */
export const requirePermission = (
  permissions: string[],
  permission: string,
  t: TranslateFn
): void => {
  if (!permissions.includes(permission)) {
    throw new ForbiddenError(t("permissions.required", { permission }));
  }
};

/**
 * Returns true if the user has the permission.
 * Use for conditional branching in services.
 *
 * Usage:
 *   if (hasPermission(context.permissions, "appointments:view_all")) { ... }
 */
export const hasPermission = (
  permissions: string[],
  permission: string
): boolean => permissions.includes(permission);

/**
 * Asserts that the authenticated user's clinicId matches the resource's clinicId.
 * Call this in services before any clinic-owned resource operation.
 *
 * ✅ clinicId MUST come from JWT — never from request input
 *
 * Usage:
 *   assertClinicAccess(req.user!.clinicId, patient.clinicId, t);
 */
export const assertClinicAccess = (
  jwtClinicId: string | undefined,
  resourceClinicId: string,
  t: TranslateFn
): void => {
  if (!jwtClinicId || jwtClinicId !== resourceClinicId) {
    throw new ForbiddenError(t("common.forbidden"));
  }
};
