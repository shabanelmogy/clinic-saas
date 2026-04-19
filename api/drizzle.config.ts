import type { Config } from "drizzle-kit";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

// ESM-safe __dirname equivalent
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env relative to this file — reliable regardless of cwd
dotenv.config({ path: resolve(__dirname, ".env") });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set. Cannot run Drizzle Kit.");
  console.error("   Copy .env.example to .env and set DATABASE_URL.");
  process.exit(1);
}

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: DATABASE_URL,
  },
  /**
   * strict: true — prompts for confirmation before any destructive migration
   * (DROP TABLE, DROP COLUMN, etc.). Prevents accidental data loss.
   */
  strict: true,
  /**
   * verbose: true — prints every SQL statement before executing.
   * Useful for reviewing what a migration will do before it runs.
   */
  verbose: true,
} satisfies Config;
