import dotenv from "dotenv";
import { z } from "zod";
import { existsSync } from "fs";
import { resolve } from "path";

// ─── .env file check ─────────────────────────────────────────────────────────

const envPath = resolve(process.cwd(), ".env");

if (!existsSync(envPath) && process.env.NODE_ENV !== "production") {
  console.error("❌ Missing .env file. Copy .env.example to .env and fill in the values.");
  console.error(`   Expected at: ${envPath}`);
  process.exit(1);
}

dotenv.config({ path: envPath });

// ─── Schema ───────────────────────────────────────────────────────────────────

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),

  // CORS — set to your frontend domain in production
  CORS_ORIGIN: z.string().default("http://localhost:3001"),

  // JWT access token
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("15m"),

  // JWT refresh token — separate secret for rotation security
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  // Logging
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // Global rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000), // 15 min
  RATE_LIMIT_MAX: z.coerce.number().default(100),

  // Auth endpoint rate limiting (stricter — brute force protection)
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000), // 15 min
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(10), // 10 attempts per window

  // Public API URL — used in Swagger docs
  API_URL: z.string().url().optional(),
});

// ─── Parse & validate ─────────────────────────────────────────────────────────

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

// ─── Runtime warnings ─────────────────────────────────────────────────────────

if (env.NODE_ENV === "production") {
  if (env.CORS_ORIGIN === "*") {
    console.warn("⚠️  WARNING: CORS_ORIGIN is '*' in production. Set it to your frontend domain.");
  }
  if (!env.API_URL) {
    console.warn("⚠️  WARNING: API_URL is not set. Swagger docs will show localhost as the server URL.");
  }
}
