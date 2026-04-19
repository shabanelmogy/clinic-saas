import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type JwtPayloadRBAC } from "../modules/rbac/jwt-rbac.js";
import { rbacRepository } from "../modules/rbac/rbac.repository.js";
import { sendError } from "../utils/response.js";
import { UnauthorizedError } from "../utils/errors.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Resolved access scope for a staff user.
 *
 * isGlobal = true  → Super Admin, no clinic restriction
 * isGlobal = false → restricted to clinicIds list
 *
 * Multi-clinic staff have multiple entries in staff_user_roles
 * and will have multiple IDs in clinicIds.
 */
export type UserScope = {
  isGlobal: boolean;
  clinicIds: string[]; // empty when isGlobal = true
};

// ─── Request augmentation ─────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayloadRBAC;
      /** Convenience shortcut — only set for clinic-scoped tokens */
      clinicId?: string;
      /** Populated by getUserScope() middleware */
      scope?: UserScope;
    }
  }
}

// ─── authenticate ─────────────────────────────────────────────────────────────

/**
 * Verifies the Bearer JWT and attaches req.user.
 * Does NOT check permissions — use authorize() for that.
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
    if (payload.clinicId) req.clinicId = payload.clinicId;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      sendError(res, err.message, 401);
    } else {
      next(err);
    }
  }
};

// ─── requireClinic ────────────────────────────────────────────────────────────

/**
 * Enforces that the authenticated user has a clinic-scoped token.
 * clinicId comes from JWT only — never from request body or params.
 */
export const requireClinic = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.clinicId) {
    sendError(res, req.t("auth.clinicRequired"), 403);
    return;
  }
  next();
};

// ─── getUserScope ─────────────────────────────────────────────────────────────

/**
 * Resolves and attaches req.scope — the user's full access scope.
 *
 * Global staff (no clinicId in JWT):
 *   req.scope = { isGlobal: true, clinicIds: [] }
 *
 * Scoped staff (clinicId in JWT):
 *   req.scope = { isGlobal: false, clinicIds: ["id1", "id2", ...] }
 *   Multi-clinic staff have multiple IDs — one per staff_user_roles row.
 *
 * Usage:
 *   router.get("/", authenticate, getUserScope, controller.list)
 */
export const getUserScope = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, req.t("auth.invalidToken"), 401);
      return;
    }

    if (!req.user.clinicId) {
      // Global staff — Super Admin, no clinic restriction
      req.scope = { isGlobal: true, clinicIds: [] };
      next();
      return;
    }

    // Scoped staff — fetch ALL their clinic assignments (supports multi-clinic)
    const assignedIds = await rbacRepository.getAssignedClinicIds(req.user.userId);
    const ids = new Set([...assignedIds, req.user.clinicId]);
    req.scope = { isGlobal: false, clinicIds: [...ids] };
    next();
  } catch (err) {
    next(err);
  }
};

// ─── enforceClinicAccess ──────────────────────────────────────────────────────

/**
 * Guards a clinic-specific route.
 * Requires getUserScope to have run first.
 *
 * Global staff → always allowed.
 * Scoped staff → allowed only if clinicId is in their assigned list.
 *
 * Usage:
 *   router.get("/:clinicId/patients", authenticate, getUserScope, enforceClinicAccess, controller.list)
 */
export const enforceClinicAccess = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const scope = req.scope;
  if (!scope) {
    sendError(res, req.t("auth.invalidToken"), 401);
    return;
  }

  if (scope.isGlobal) {
    next();
    return;
  }

  const targetClinicId = (req.params.clinicId ?? req.user?.clinicId) as string | undefined;

  if (!targetClinicId) {
    sendError(res, req.t("auth.clinicRequired"), 403);
    return;
  }

  if (!scope.clinicIds.includes(targetClinicId)) {
    sendError(res, req.t("common.forbidden"), 403);
    return;
  }

  next();
};

// ─── Service-layer helpers ────────────────────────────────────────────────────

/**
 * Resolves the user's access scope for use inside services.
 *
 * Global staff → { isGlobal: true, clinicIds: [] }
 * Scoped staff → { isGlobal: false, clinicIds: [...assigned] }
 *
 * Usage:
 *   const scope = await resolveUserScope(req.user!);
 *   if (scope.isGlobal) { // no WHERE filter }
 *   else { // WHERE clinic_id IN (scope.clinicIds) }
 */
export async function resolveUserScope(user: JwtPayloadRBAC): Promise<UserScope> {
  if (!user.clinicId) {
    return { isGlobal: true, clinicIds: [] };
  }
  const assigned = await rbacRepository.getAssignedClinicIds(user.userId);
  const ids = new Set([...assigned, user.clinicId]);
  return { isGlobal: false, clinicIds: [...ids] };
}

/**
 * Returns the JWT clinicId for single-clinic operations.
 * Global staff → undefined (no restriction)
 * Scoped staff → their clinicId
 */
export function getTokenClinicId(user: JwtPayloadRBAC): string | undefined {
  return user.clinicId;
}
