import { eq, and, count, SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  doctorRequests,
  type DoctorRequest,
  type NewDoctorRequest,
} from "./doctor-request.schema.js";
import type { ListDoctorRequestsQuery } from "./doctor-request.validation.js";

export const doctorRequestRepository = {
  /**
   * List requests — super admin sees all; clinic staff scoped to their clinic.
   */
  async findAll(
    query: ListDoctorRequestsQuery,
    clinicId?: string
  ): Promise<{ data: DoctorRequest[]; total: number }> {
    const { page, limit, status, type } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (clinicId) conditions.push(eq(doctorRequests.clinicId, clinicId));
    if (status) conditions.push(eq(doctorRequests.status, status));
    if (type) conditions.push(eq(doctorRequests.type, type));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, [{ value: total }]] = await Promise.all([
      db
        .select()
        .from(doctorRequests)
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(doctorRequests.createdAt),
      db.select({ value: count() }).from(doctorRequests).where(where),
    ]);

    return { data, total: Number(total) };
  },

  async findById(id: string): Promise<DoctorRequest | undefined> {
    const [request] = await db
      .select()
      .from(doctorRequests)
      .where(eq(doctorRequests.id, id));
    return request;
  },

  /**
   * Find a pending join request from the same email for the same clinic.
   * Prevents duplicate pending requests.
   */
  async findPendingJoinByEmail(
    email: string,
    clinicId: string
  ): Promise<DoctorRequest | undefined> {
    const [request] = await db
      .select()
      .from(doctorRequests)
      .where(
        and(
          eq(doctorRequests.email, email.toLowerCase()),
          eq(doctorRequests.clinicId, clinicId),
          eq(doctorRequests.type, "join"),
          eq(doctorRequests.status, "pending")
        )
      );
    return request;
  },

  /**
   * Find a pending create request from the same email.
   * One pending clinic-creation request per email at a time.
   */
  async findPendingCreateByEmail(email: string): Promise<DoctorRequest | undefined> {
    const [request] = await db
      .select()
      .from(doctorRequests)
      .where(
        and(
          eq(doctorRequests.email, email.toLowerCase()),
          eq(doctorRequests.type, "create"),
          eq(doctorRequests.status, "pending")
        )
      );
    return request;
  },

  async create(data: NewDoctorRequest): Promise<DoctorRequest> {
    const [request] = await db.insert(doctorRequests).values(data).returning();
    return request;
  },

  async update(
    id: string,
    data: Partial<NewDoctorRequest>
  ): Promise<DoctorRequest | undefined> {
    const [request] = await db
      .update(doctorRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(doctorRequests.id, id))
      .returning();
    return request;
  },
};
