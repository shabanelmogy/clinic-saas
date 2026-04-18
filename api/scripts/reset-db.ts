#!/usr/bin/env tsx
/**
 * Database Reset Script
 * 
 * WARNING: This script will DROP ALL TABLES and recreate them.
 * Use only in development/testing environments.
 * 
 * Usage:
 *   npm run db:reset
 * 
 * What it does:
 * 1. Drops all tables (if they exist)
 * 2. Drops all enums (if they exist)
 * 3. Runs all migrations
 * 4. Seeds RBAC data (permissions, roles, role-permissions)
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load environment variables
dotenv.config();

const { Pool } = pg;

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg: string) => console.log(`${colors.cyan}→${colors.reset} ${msg}`),
};

async function resetDatabase() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    log.error("DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  // Safety check - prevent running on production
  if (process.env.NODE_ENV === "production") {
    log.error("Cannot run database reset in production environment!");
    log.error("This script is for development/testing only.");
    process.exit(1);
  }

  // Additional safety check for production-like URLs
  if (
    DATABASE_URL.includes("prod") ||
    DATABASE_URL.includes("production") ||
    DATABASE_URL.includes("aws.com") ||
    DATABASE_URL.includes("azure.com") ||
    DATABASE_URL.includes("cloud.google.com")
  ) {
    log.error("Database URL appears to be a production database!");
    log.error("Refusing to reset. Use a local/development database.");
    process.exit(1);
  }

  log.warning("⚠️  DATABASE RESET - ALL DATA WILL BE LOST ⚠️");
  log.info(`Database: ${DATABASE_URL.split("@")[1] || "localhost"}`);
  console.log("");

  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  try {
    // Step 1: Drop all tables
    log.step("Step 1: Dropping all tables...");
    
    await db.execute(sql`
      DROP TABLE IF EXISTS user_roles CASCADE;
      DROP TABLE IF EXISTS role_permissions CASCADE;
      DROP TABLE IF EXISTS permissions CASCADE;
      DROP TABLE IF EXISTS roles CASCADE;
      DROP TABLE IF EXISTS refresh_tokens CASCADE;
      DROP TABLE IF EXISTS appointments CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);
    
    log.success("All tables dropped");

    // Step 2: Drop all enums
    log.step("Step 2: Dropping all enums...");
    
    await db.execute(sql`
      DROP TYPE IF EXISTS appointment_status CASCADE;
      DROP TYPE IF EXISTS user_role CASCADE;
    `);
    
    log.success("All enums dropped");

    // Step 3: Run migrations
    log.step("Step 3: Running migrations...");
    
    const migrationsFolder = join(projectRoot, "drizzle");
    await migrate(db, { migrationsFolder });
    
    log.success("Migrations applied");

    // Step 4: Seed RBAC data
    log.step("Step 4: Seeding RBAC data...");
    
    // Import and run seed script
    const { seedRBAC } = await import("../src/modules/rbac/seed-rbac.js");
    await seedRBAC();
    
    log.success("RBAC data seeded");

    console.log("");
    log.success("✨ Database reset complete!");
    console.log("");
    log.info("Next steps:");
    log.info("  1. Start the server: npm run dev");
    log.info("  2. Create a test user via API or seed script");
    log.info("  3. Test authentication and RBAC");
    console.log("");

  } catch (error) {
    console.log("");
    log.error("Database reset failed!");
    
    if (error instanceof Error) {
      log.error(`Error: ${error.message}`);
      
      if (error.message.includes("does not exist")) {
        log.warning("Some tables/enums didn't exist - this is normal on first run");
      } else {
        console.error(error);
      }
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the reset
resetDatabase();
