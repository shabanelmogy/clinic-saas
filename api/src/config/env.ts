import dotenv from "dotenv";
import { z } from "zod";
import { existsSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env");

if (!existsSync(envPath) && process.env.NODE_ENV !== "production") {
  console.error("❌ Missing .env file. Copy .env.example to .env and fill in the values.");
  console.error(`   Expected at: ${envPath}`);
  process.exit(1);
}

dotenv.config({ path: envPath });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  CORS_ORIGIN: z.string().default("http://localhost:3001"),

  // JWT
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  // Logging
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000), // 15 min
  RATE_LIMIT_MAX: z.coerce.number().default(100),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

// Warn if CORS is open wildcard in production
if (env.NODE_ENV === "production" && env.CORS_ORIGIN === "*") {
  console.warn("⚠️  WARNING: CORS_ORIGIN is set to '*' in production. Set it to your frontend domain.");
}
