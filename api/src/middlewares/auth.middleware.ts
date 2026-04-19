import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type JwtPayloadRBAC } from "../modules/rbac/jwt-rbac.js";
import { sendError } from "../utils/response.js";
import { UnauthorizedError } from "../utils/errors.js";

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
