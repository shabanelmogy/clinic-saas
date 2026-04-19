import rateLimit from "express-rate-limit";
import { env } from "./env.js";
import { sendError } from "../utils/response.js";
import type { Request, Response } from "express";

// ─── Global rate limiter ──────────────────────────────────────────────────────

/**
 * Applied to all /api/ routes.
 * Configurable via RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX env vars.
 */
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,   // RateLimit-* headers (RFC 6585)
  legacyHeaders: false,    // Disable X-RateLimit-* headers
  handler: (_req: Request, res: Response) => {
    sendError(res, "Too many requests, please try again later", 429);
  },
});

// ─── Auth rate limiter ────────────────────────────────────────────────────────

/**
 * Applied to login, refresh, and logout endpoints.
 * Stricter than global — prevents brute force and credential stuffing.
 *
 * Configurable via AUTH_RATE_LIMIT_WINDOW_MS and AUTH_RATE_LIMIT_MAX env vars.
 * Defaults: 10 attempts per 15 minutes.
 *
 * skipSuccessfulRequests: true — only failed attempts count toward the limit.
 * A successful login does not burn the rate limit budget.
 */
export const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req: Request, res: Response) => {
    sendError(
      res,
      `Too many attempts. Please try again in ${Math.ceil(env.AUTH_RATE_LIMIT_WINDOW_MS / 60_000)} minutes.`,
      429
    );
  },
});
