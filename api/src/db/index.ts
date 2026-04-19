import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const { Pool } = pg;

// ─── SSL config ───────────────────────────────────────────────────────────────

/**
 * SSL is required in production (managed DBs: RDS, Supabase, Neon, etc.).
 * Set DB_SSL=true in your environment to enable.
 * In production, SSL is always enforced regardless of DB_SSL.
 */
const sslConfig =
  env.NODE_ENV === "production" || env.DB_SSL === "true"
    ? { rejectUnauthorized: false } // set to true + provide CA cert for strict verification
    : undefined;

// ─── Connection pool ──────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DB_POOL_CONNECTION_TIMEOUT_MS,
  ssl: sslConfig,
});

/**
 * Log idle client errors but do NOT crash the process.
 * The pool will attempt to reconnect automatically.
 * Only truly unrecoverable errors (e.g. invalid credentials) warrant a shutdown,
 * and those will surface as connection errors on the next query.
 */
pool.on("error", (err: Error) => {
  logger.error({ err }, "Unexpected error on idle PostgreSQL client");
});

// ─── Drizzle instance ─────────────────────────────────────────────────────────

export const db = drizzle(pool, { schema });
export type DB = typeof db;

// ─── Graceful shutdown ────────────────────────────────────────────────────────

/**
 * Drain the pool on process shutdown.
 * Called by server.ts shutdown handlers.
 */
export const closeDb = async (): Promise<void> => {
  await pool.end();
  logger.info("Database pool closed");
};
