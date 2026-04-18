import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "../users/user.schema.js";

// ─── Table ────────────────────────────────────────────────────────────────────

/**
 * Refresh tokens table.
 *
 * ✅ userId references GLOBAL users — no clinic_id needed.
 * Token rotation with family tracking for reuse detection.
 * Tokens are hashed (SHA-256) before storage.
 */
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    // SHA-256 hash of the raw token — never store the raw value
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    familyId: uuid("family_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: varchar("user_agent", { length: 512 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tokenHashIdx: index("refresh_tokens_token_hash_idx").on(t.tokenHash),
    userIdIdx: index("refresh_tokens_user_id_idx").on(t.userId),
    familyIdIdx: index("refresh_tokens_family_id_idx").on(t.familyId),
    expiresAtIdx: index("refresh_tokens_expires_at_idx").on(t.expiresAt),
  })
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
