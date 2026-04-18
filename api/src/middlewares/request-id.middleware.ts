import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

// Extend Express Request with a correlation ID
declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

/**
 * Attaches a unique request ID to every request.
 * Reads X-Request-ID header if provided (useful for tracing across services),
 * otherwise generates a new UUID.
 */
export const requestId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const id = (req.headers["x-request-id"] as string) ?? randomUUID();
  req.id = id;
  res.setHeader("X-Request-ID", id);
  next();
};
