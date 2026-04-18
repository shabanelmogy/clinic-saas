import { eq, and, lt, isNull } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { db } from "../../db/index.js";
import { refreshTokens, type RefreshToken } from "./auth.schema.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Hash a raw token before storing — never persist the raw value */
export const hashToken = (raw: string): string =>
  createHash("sha256").update(raw).digest("hex");

/** Generate a cryptographically random opaque token */
export const generateOpaqueToken = (): string =>
  randomBytes(64).toString("hex");

// ─── Repository ───────────────────────────────────────────────────────────────

export const authRepository = {
  /** Persist a new refresh token row and return the raw token to send to client */
  async create(data: {
    userId: string;
    familyId: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<string> {
    const raw = generateOpaqueToken();
    await db.insert(refreshTokens).values({
      userId: data.userId,
      tokenHash: hashToken(raw),
      familyId: data.familyId,
      expiresAt: data.expiresAt,
      userAgent: data.userAgent,
      ipAddress: data.ipAddress,
    });
    return raw;
  },

  /** Find a token row by its raw value */
  async findByRawToken(raw: string): Promise<RefreshToken | undefined> {
    const [token] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashToken(raw)));
    return token;
  },

  /** Revoke a single token (soft-delete) */
  async revoke(id: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, id));
  },

  /** Revoke all tokens in a family — used when reuse is detected (stolen token) */
  async revokeFamilyAll(familyId: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.familyId, familyId),
          isNull(refreshTokens.revokedAt)
        )
      );
  },

  /** Revoke all tokens for a user — used on logout-all / account deactivation */
  async revokeAllForUser(userId: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.userId, userId));
  },

  /** Purge expired tokens — run this on a cron job */
  async deleteExpired(): Promise<void> {
    await db
      .delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, new Date()));
  },

  /** Hard-delete all tokens for a user — must be called before deleting the user (restrict FK) */
  async deleteAllForUser(userId: string): Promise<void> {
    await db
      .delete(refreshTokens)
      .where(eq(refreshTokens.userId, userId));
  },
};
