import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";
import { sendError } from "../utils/response.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

// PostgreSQL error codes
const PG_ERRORS: Record<string, { status: number; message: string }> = {
  "23505": { status: 409, message: "A record with that value already exists" },
  "23503": { status: 409, message: "Referenced record does not exist" },
  "23502": { status: 400, message: "A required field is missing" },
  "23514": { status: 400, message: "A value violates a check constraint" },
  "42P01": { status: 500, message: "Database table not found — run migrations" },
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Known operational errors
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, reqId: req.id }, err.message);
    }
    sendError(res, err.message, err.statusCode);
    return;
  }

  // PostgreSQL / Drizzle errors
  const pgCode = (err as NodeJS.ErrnoException & { code?: string }).code;
  if (pgCode && pgCode in PG_ERRORS) {
    const { status, message } = PG_ERRORS[pgCode];
    sendError(res, message, status);
    return;
  }

  // Unexpected errors — always log these
  logger.error({ err, reqId: req.id, path: req.path }, "Unhandled error");

  const message =
    env.NODE_ENV === "production" ? "Internal server error" : err.message;

  sendError(res, message, 500);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  sendError(res, `Route ${req.method} ${req.path} not found`, 404);
};
