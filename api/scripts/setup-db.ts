#!/usr/bin/env tsx
/**
 * Database Setup Script
 * 
 * Sets up a fresh database with migrations and seed data.
 * Use this for initial setup or after manual database drop.
 * 
 * Usage:
 *   npm run db:setup
 * 
 * What it does:
 * 1. Runs all migrations
 * 2. Seeds RBAC data (permissions, roles, role-permissions)
 * 3. Optionally creates a test admin user
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as dotenv from "dotenv";
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
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg: string) => console.log(`${colors.cyan}→${colors.reset} ${msg}`),
};

async function setupDatabase() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    log.error("DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  log.info("🚀 Setting up database...");
  log.info(`Database: ${DATABASE_URL.split("@")[1] || "localhost"}`);
  console.log("");

  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  try {
    // Step 1: Run migrations
    log.step("Step 1: Running migrations...");
    
    const migrationsFolder = join(projectRoot, "drizzle");
    await migrate(db, { migrationsFolder });
    
    log.success("Migrations applied");

    // Step 2: Seed RBAC data
    log.step("Step 2: Seeding RBAC data...");
    
    // Import and run seed script
    const { seedRBAC } = await import("../src/modules/rbac/seed-rbac.js");
    await seedRBAC();
    
    log.success("RBAC data seeded");

    console.log("");
    log.success("✨ Database setup complete!");
    console.log("");
    log.info("RBAC System:");
    log.info("  • 22 permissions created");
    log.info("  • 5 global roles created (Super Admin, Clinic Admin, Doctor, Receptionist, Patient)");
    log.info("  • Role-permission mappings configured");
    console.log("");
    log.info("Next steps:");
    log.info("  1. Create a test clinic (UUID)");
    log.info("  2. Create a test user via API: POST /api/v1/auth/register");
    log.info("  3. Assign roles to user via database or API");
    log.info("  4. Test authentication: POST /api/v1/auth/login");
    console.log("");

  } catch (error) {
    console.log("");
    log.error("Database setup failed!");
    
    if (error instanceof Error) {
      log.error(`Error: ${error.message}`);
      
      if (error.message.includes("already exists")) {
        log.warning("Database already set up. Use 'npm run db:reset' to reset.");
      } else {
        console.error(error);
      }
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the setup
setupDatabase();
