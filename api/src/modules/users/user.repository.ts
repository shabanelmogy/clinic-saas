import { eq, ilike, and, count, SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users, type User, type NewUser } from "./user.schema.js";
import type { ListUsersQuery } from "./user.validation.js";

/**
 * User repository — operates on GLOBAL users (no clinic_id).
 *
 * ✅ No clinicId parameter — users are platform-wide entities.
 * ✅ Email is globally unique.
 */
export const userRepository = {
  /**
   * Find all users with optional filters.
   * Global — not scoped to any clinic.
   */
  async findAll(
    query: ListUsersQuery
  ): Promise<{ data: User[]; total: number }> {
    const { page, limit, isActive, search } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (isActive !== undefined) conditions.push(eq(users.isActive, isActive));
    if (search) conditions.push(ilike(users.name, `%${search}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, [{ value: total }]] = await Promise.all([
      db
        .select()
        .from(users)
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(users.createdAt),
      db.select({ value: count() }).from(users).where(where),
    ]);

    return { data, total: Number(total) };
  },

  /**
   * Find user by ID — global lookup.
   */
  async findById(id: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id));
    return user;
  },

  /**
   * Find user by email — globally unique.
   */
  async findByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));
    return user;
  },

  /**
   * Create a new global user.
   */
  async create(data: NewUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({ ...data, email: data.email.toLowerCase() })
      .returning();
    return user;
  },

  /**
   * Update a user — global, no clinic scope.
   */
  async update(
    id: string,
    data: Partial<NewUser>
  ): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        ...data,
        ...(data.email && { email: data.email.toLowerCase() }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  },

  /**
   * Delete a user — global, no clinic scope.
   */
  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning();
    return result.length > 0;
  },
};
