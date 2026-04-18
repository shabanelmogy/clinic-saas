import rateLimit from "express-rate-limit";
import { env } from "./env.js";
import { sendError } from "../utils/response.js";
import type { Request, Response } from "express";

/**
 * General API rate limiter — applied globally.
 */
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,  // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    sendError(res, "Too many requests, please try again later", 429);
  },
});

/**
 * Stricter limiter for auth endpoints — prevents brute force.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    sendError(res, "Too many login attempts, please try again in 15 minutes", 429);
  },
});
