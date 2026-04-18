import { sql } from "drizzle-orm";
import { db } from "../db/index.js";

/**
 * Database health status with detailed information
 */
export interface DbHealthStatus {
  connected: boolean;
  latency?: number;
  error?: string;
}

/**
 * Check database connection health with latency measurement
 * 
 * @returns Health status with connection state, latency, and error details
 */
export const checkDbConnection = async (): Promise<DbHealthStatus> => {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return {
      connected: true,
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
};

/**
 * Simple boolean health check (backward compatible)
 * 
 * @returns true if database is connected, false otherwise
 */
export const isDbConnected = async (): Promise<boolean> => {
  const status = await checkDbConnection();
  return status.connected;
};
