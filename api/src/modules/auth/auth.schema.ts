import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { staffUsers } from "../staff-users/staff-user.schema.js";

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * ✅ FIX #9: onDelete changed from "restrict" to "cascade".
     * "restrict" blocks hard-deletion of a staff user who has tokens.
     * "cascade" ensures tokens are cleaned up automatically when a staff user
     * is hard-deleted. Soft-delete (deletedAt) is the normal path and doesn't
     * trigger this FK at all.
     */
    staffUserId: uuid("staff_user_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
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
    staffUserIdIdx: index("refresh_tokens_staff_user_id_idx").on(t.staffUserId),
    familyIdIdx: index("refresh_tokens_family_id_idx").on(t.familyId),
    // Token cleanup job: find all expired tokens efficiently
    expiresAtIdx: index("refresh_tokens_expires_at_idx").on(t.expiresAt),
  })
);

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
