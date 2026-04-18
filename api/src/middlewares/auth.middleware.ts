import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type JwtPayloadRBAC } from "../modules/rbac/jwt-rbac.js";
import { sendError } from "../utils/response.js";
import { UnauthorizedError } from "../utils/errors.js";

// Extend Express Request with authenticated user context
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayloadRBAC;
      /**
       * Convenience shortcut — only set for staff tokens.
       * Patient requests will have this as undefined.
       * Always prefer req.user.clinicId over this for explicit intent.
       */
      clinicId?: string;
    }
  }
}

/**
 * Verifies the Bearer token and attaches `req.user`.
 * For staff tokens also sets `req.clinicId` as a convenience shortcut.
 *
 * Does NOT check permissions — use authorize() from rbac/authorize.middleware.ts.
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    sendError(res, "Missing or malformed Authorization header", 401);
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;

    // Only set clinicId for staff — patients have no clinic scope
    if (payload.userType === "staff" && payload.clinicId) {
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
