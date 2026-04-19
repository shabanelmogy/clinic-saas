import { eq, ilike, and, count, isNull, SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { staffUsers, type StaffUser, type NewStaffUser } from "./staff-user.schema.js";
import type { ListStaffUsersQuery } from "./staff-user.validation.js";

export const staffUserRepository = {
  /**
   * List all non-deleted staff users — global, no clinic scope.
   */
  async findAll(query: ListStaffUsersQuery): Promise<{ data: StaffUser[]; total: number }> {
    const { page, limit, isActive, search } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [isNull(staffUsers.deletedAt)];
    if (isActive !== undefined) conditions.push(eq(staffUsers.isActive, isActive));
    if (search) conditions.push(ilike(staffUsers.name, `%${search}%`));

    const where = and(...conditions);

    const [data, [{ value: total }]] = await Promise.all([
      db.select().from(staffUsers).where(where).limit(limit).offset(offset).orderBy(staffUsers.createdAt),
      db.select({ value: count() }).from(staffUsers).where(where),
    ]);

    return { data, total: Number(total) };
  },

  async findById(id: string): Promise<StaffUser | undefined> {
    const [staffUser] = await db
      .select()
      .from(staffUsers)
      .where(and(eq(staffUsers.id, id), isNull(staffUsers.deletedAt)));
    return staffUser;
  },

  async findByEmail(email: string): Promise<StaffUser | undefined> {
    const [staffUser] = await db
      .select()
      .from(staffUsers)
      .where(and(eq(staffUsers.email, email.toLowerCase()), isNull(staffUsers.deletedAt)));
    return staffUser;
  },

  async create(data: NewStaffUser): Promise<StaffUser> {
    const [staffUser] = await db
      .insert(staffUsers)
      .values({ ...data, email: data.email.toLowerCase() })
      .returning();
    return staffUser;
  },

  async update(id: string, data: Partial<NewStaffUser>): Promise<StaffUser | undefined> {
    const [staffUser] = await db
      .update(staffUsers)
      .set({
        ...data,
        ...(data.email && { email: data.email.toLowerCase() }),
        updatedAt: new Date(),
      })
      .where(and(eq(staffUsers.id, id), isNull(staffUsers.deletedAt)))
      .returning();
    return staffUser;
  },

  /**
   * Soft-delete — sets deletedAt and deactivates.
   * Tokens are revoked by the service before calling this.
   */
  async softDelete(id: string): Promise<boolean> {
    const result = await db
      .update(staffUsers)
      .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
      .where(and(eq(staffUsers.id, id), isNull(staffUsers.deletedAt)))
      .returning();
    return result.length > 0;
  },
};
