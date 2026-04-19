import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type JwtPayloadRBAC } from "../modules/rbac/jwt-rbac.js";
import { rbacRepository } from "../modules/rbac/rbac.repository.js";
import { db } from "../db/index.js";
import { clinics } from "../modules/clinics/clinic.schema.js";
import { sendError } from "../utils/response.js";
import { UnauthorizedError } from "../utils/errors.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The resolved access scope for a staff user.
 *
 * isGlobal = true  → Super Admin, no clinic restriction
 * isGlobal = false → scoped to clinicIds list
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
      clinicId?: string;
      /** Populated by getUserScope() middleware */
      scope?: UserScope;
    }
  }
}

// ─── authenticate ─────────────────────────────────────────────────────────────

/**
 * Verifies the Bearer JWT and attaches `req.user`.
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
 * Use on routes that MUST have a clinicId.
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
 *   // then in controller: req.scope!
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

    // Global staff — no clinicId in JWT
    if (!req.user.clinicId) {
      req.scope = { isGlobal: true, clinicIds: [] };
      next();
      return;
    }

    // Scoped staff — fetch ALL their clinic assignments from DB
    // This supports multi-clinic staff who have multiple staff_user_roles rows
    const assignedIds = await rbacRepository.getAssignedClinicIds(req.user.userId);

    // Always include the JWT clinicId (current session clinic)
    const ids = new Set([...assignedIds, req.user.clinicId]);

    req.scope = { isGlobal: false, clinicIds: [...ids] };
    next();
  } catch (err) {
    next(err);
  }
};

// ─── enforceClinicAccess ──────────────────────────────────────────────────────

/**
 * Enforces that the authenticated user can access a specific clinic.
 * Reads clinicId from req.params.clinicId or req.user.clinicId.
 *
 * Global staff → always allowed.
 * Scoped staff → allowed only if clinicId is in their assigned list.
 *
 * Requires getUserScope to have run first.
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

  // Global staff — unrestricted
  if (scope.isGlobal) {
    next();
    return;
  }

  // Resolve the target clinicId — from URL param or JWT
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

// ─── getAccessibleClinicIds ───────────────────────────────────────────────────

/**
 * Returns clinic IDs the user can access, for use in service-layer queries.
 *
 * Global staff → fetches ALL clinic IDs from DB
 * Scoped staff → returns their assigned clinic IDs
 *
 * Usage in services:
 *   const { isGlobal, clinicIds } = await resolveUserScope(req.user!);
 *   if (isGlobal) { // no WHERE clinic_id filter }
 *   else { // WHERE clinic_id IN (clinicIds) }
 */
export async function resolveUserScope(user: JwtPayloadRBAC): Promise<UserScope> {
  if (!user.clinicId) {
    return { isGlobal: true, clinicIds: [] };
  }

  const assigned = await rbacRepository.getAssignedClinicIds(user.userId);
  const ids = new Set([...assigned, user.clinicId]);
  return { isGlobal: false, clinicIds: [...ids] };
}

/** @deprecated Use resolveUserScope() instead */
export async function getAccessibleClinicIds(
  user: JwtPayloadRBAC
): Promise<string[] | "all"> {
  if (!user.clinicId) return "all";
  const assigned = await rbacRepository.getAssignedClinicIds(user.userId);
  const ids = new Set([...assigned, user.clinicId]);
  return [...ids];
}

export function getTokenClinicId(user: JwtPayloadRBAC): string | undefined {
  return user.clinicId;
}

// ─── Request augmentation ─────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayloadRBAC;
      /**
       * Convenience shortcut for req.user.clinicId.
       * Only set for clinic-scoped staff tokens.
       * Always prefer req.user!.clinicId for explicit intent.
       */
      clinicId?: string;
    }
  }
}

// ─── authenticate ─────────────────────────────────────────────────────────────

/**
 * Verifies the Bearer JWT and attaches `req.user`.
 *
 * - Reads Authorization: Bearer <token>
 * - Verifies signature and expiry
 * - Rejects non-staff tokens (userType guard in verifyAccessToken)
 * - Sets req.clinicId for clinic-scoped tokens
 * - Does NOT check permissions — use authorize() for that
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

    // Set clinicId shortcut for clinic-scoped staff tokens
    if (payload.clinicId) {
      req.clinicId = payload.clinicId;
    }

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
 * Use on routes that MUST have a clinicId (all clinic-owned resource routes).
 *
 * ✅ clinicId ONLY comes from JWT — never from request body or params
 *
 * Usage:
 *   router.get("/patients", authenticate, requireClinic, authorize("patients:view"), controller.list)
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

// ─── getAccessibleClinicIds ───────────────────────────────────────────────────

/**
 * Returns the list of clinic IDs the authenticated user can access.
 *
 * Global staff (no clinicId in JWT):
 *   → fetches ALL active clinic IDs from the database
 *
 * Scoped staff (clinicId in JWT):
 *   → returns only their assigned clinic IDs from staff_user_roles
 *
 * Usage in services:
 *   const clinicIds = await getAccessibleClinicIds(req.user!);
 *   // then: WHERE clinic_id IN (clinicIds)  — or no filter if global
 *
 * Usage pattern:
 *   const clinicIds = await getAccessibleClinicIds(req.user!);
 *   if (clinicIds === "all") {
 *     // no clinic restriction — global staff
 *   } else {
 *     // restrict to clinicIds
 *   }
 */
export async function getAccessibleClinicIds(
  user: JwtPayloadRBAC
): Promise<string[] | "all"> {
  // Global staff — no clinicId in JWT means Super Admin / global role
  if (!user.clinicId) {
    const allClinics = await db
      .select({ id: clinics.id })
      .from(clinics);
    return allClinics.map((c) => c.id);
  }

  // Scoped staff — fetch all clinics they are assigned to via staff_user_roles
  const assigned = await rbacRepository.getAssignedClinicIds(user.userId);

  // Always include the current JWT clinic even if somehow not in assignments
  const ids = new Set([...assigned, user.clinicId]);
  return [...ids];
}

/**
 * Synchronous version — returns just the JWT clinicId for single-clinic operations.
 * Use when you only need to enforce the current token's clinic scope.
 *
 * Global staff → undefined (no restriction)
 * Scoped staff → their clinicId
 */
export function getTokenClinicId(user: JwtPayloadRBAC): string | undefined {
  return user.clinicId;
}
