import { eq, and, gte, lte, count, SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { slotTimes, type SlotTime, type NewSlotTime } from "./slot-time.schema.js";
import type { ListSlotsQuery } from "./slot-time.validation.js";

export const slotTimeRepository = {
  /**
   * List slots for a clinic — filtered by doctor, status, and date range.
   * ✅ Always scoped to clinicId — tenant isolation.
   */
  async findAll(
    clinicId: string,
    query: ListSlotsQuery
  ): Promise<{ data: SlotTime[]; total: number }> {
    const { page, limit, doctorId, status, from, to } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(slotTimes.clinicId, clinicId)];
    if (doctorId) conditions.push(eq(slotTimes.doctorId, doctorId));
    if (status) conditions.push(eq(slotTimes.status, status));
    if (from) conditions.push(gte(slotTimes.startTime, new Date(from)));
    if (to) conditions.push(lte(slotTimes.startTime, new Date(to)));

    const where = and(...conditions);

    const [data, [{ value: total }]] = await Promise.all([
      db.select().from(slotTimes).where(where).limit(limit).offset(offset).orderBy(slotTimes.startTime),
      db.select({ value: count() }).from(slotTimes).where(where),
    ]);

    return { data, total: Number(total) };
  },

  async findById(id: string, clinicId: string): Promise<SlotTime | undefined> {
    const [slot] = await db
      .select()
      .from(slotTimes)
      .where(and(eq(slotTimes.id, id), eq(slotTimes.clinicId, clinicId)));
    return slot;
  },

  /**
   * Bulk insert generated slots — used by the slot generation job.
   * onConflictDoNothing: if a slot already exists for (doctorId, startTime), skip it.
   */
  async bulkInsert(data: NewSlotTime[]): Promise<number> {
    if (data.length === 0) return 0;
    const result = await db
      .insert(slotTimes)
      .values(data)
      .onConflictDoNothing({ target: [slotTimes.doctorId, slotTimes.startTime] })
      .returning({ id: slotTimes.id });
    return result.length;
  },

  /**
   * Mark a slot as booked — atomic optimistic guard.
   *
   * ✅ WHERE status = 'available' is the race-condition guard.
   *    If two concurrent requests hit this simultaneously, only one UPDATE
   *    will match (PostgreSQL row-level locking on UPDATE).
   *    The loser gets 0 rows returned → service returns 409.
   *
   * Call this AFTER inserting the appointment row (appointment owns slotId FK).
   */
  async book(id: string, clinicId: string): Promise<SlotTime | undefined> {
    const [slot] = await db
      .update(slotTimes)
      .set({ status: "booked", updatedAt: new Date() })
      .where(and(
        eq(slotTimes.id, id),
        eq(slotTimes.clinicId, clinicId),
        eq(slotTimes.status, "available"),  // ✅ Atomic guard — only book if still available
      ))
      .returning();
    return slot;
  },

  /**
   * Release a slot back to available — called on appointment cancellation.
   * ✅ WHERE status = 'booked' prevents double-release.
   */
  async release(id: string, clinicId: string): Promise<SlotTime | undefined> {
    const [slot] = await db
      .update(slotTimes)
      .set({ status: "available", updatedAt: new Date() })
      .where(and(
        eq(slotTimes.id, id),
        eq(slotTimes.clinicId, clinicId),
        eq(slotTimes.status, "booked"),  // ✅ Only release if currently booked
      ))
      .returning();
    return slot;
  },

  /**
   * Block or unblock a slot manually — staff action (holiday, break, etc.)
   * Cannot block a booked slot.
   */
  async updateStatus(
    id: string,
    clinicId: string,
    status: "available" | "blocked"
  ): Promise<SlotTime | undefined> {
    const [slot] = await db
      .update(slotTimes)
      .set({ status, updatedAt: new Date() })
      .where(and(
        eq(slotTimes.id, id),
        eq(slotTimes.clinicId, clinicId),
        eq(slotTimes.status, status === "blocked" ? "available" : "blocked"),
      ))
      .returning();
    return slot;
  },

  /**
   * Delete future available slots for a doctor — called when a schedule rule is deleted.
   * Only removes 'available' slots (booked slots are live appointments — never touch them).
   */
  async deleteFutureAvailable(doctorId: string, clinicId: string): Promise<number> {
    const result = await db
      .delete(slotTimes)
      .where(and(
        eq(slotTimes.doctorId, doctorId),
        eq(slotTimes.clinicId, clinicId),
        eq(slotTimes.status, "available"),
        gte(slotTimes.startTime, new Date()),
      ))
      .returning({ id: slotTimes.id });
    return result.length;
  },

  /**
   * Count available slots for a doctor in a date range — availability check.
   */
  async countAvailable(doctorId: string, clinicId: string, from: Date, to: Date): Promise<number> {
    const [{ value }] = await db
      .select({ value: count() })
      .from(slotTimes)
      .where(and(
        eq(slotTimes.doctorId, doctorId),
        eq(slotTimes.clinicId, clinicId),
        eq(slotTimes.status, "available"),
        gte(slotTimes.startTime, from),
        lte(slotTimes.startTime, to),
      ));
    return Number(value);
  },
};
