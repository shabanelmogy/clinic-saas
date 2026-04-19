import { eq, and, isNull, isNotNull, count, SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  patientRequests,
  type PatientRequest,
  type NewPatientRequest,
} from "./patient-request.schema.js";
import type { ListPatientRequestsQuery } from "./patient-request.validation.js";

export const patientRequestRepository = {
  /**
   * List requests.
   *
   * Scoping rules:
   *   - clinicId provided (clinic staff)  → scoped to that clinic
   *   - clinicId absent (super admin)     → all requests
   *   - unassigned=true                   → only requests with no clinic
   */
  async findAll(
    query: ListPatientRequestsQuery,
    clinicId?: string
  ): Promise<{ data: PatientRequest[]; total: number }> {
    const { page, limit, status, unassigned } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];

    if (clinicId) {
      // Clinic staff: always scoped
      conditions.push(eq(patientRequests.clinicId, clinicId));
    } else if (unassigned) {
      // Super admin: show only unassigned
      conditions.push(isNull(patientRequests.clinicId));
    }
    // else: super admin sees all

    if (status) conditions.push(eq(patientRequests.status, status));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, [{ value: total }]] = await Promise.all([
      db
        .select()
        .from(patientRequests)
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(patientRequests.createdAt),
      db.select({ value: count() }).from(patientRequests).where(where),
    ]);

    return { data, total: Number(total) };
  },

  /**
   * Find by ID.
   * If clinicId is provided, enforces tenant isolation.
   * Super admin (no clinicId) can access any request.
   */
  async findById(id: string, clinicId?: string): Promise<PatientRequest | undefined> {
    const conditions: SQL[] = [eq(patientRequests.id, id)];
    if (clinicId) conditions.push(eq(patientRequests.clinicId, clinicId));

    const [request] = await db
      .select()
      .from(patientRequests)
      .where(and(...conditions));
    return request;
  },

  /**
   * Find a pending request by phone within a clinic.
   * Prevents duplicate pending requests from the same phone per clinic.
   */
  async findPendingByPhone(
    phone: string,
    clinicId: string
  ): Promise<PatientRequest | undefined> {
    const [request] = await db
      .select()
      .from(patientRequests)
      .where(
        and(
          eq(patientRequests.phone, phone),
          eq(patientRequests.clinicId, clinicId),
          eq(patientRequests.status, "pending")
        )
      );
    return request;
  },

  async create(data: NewPatientRequest): Promise<PatientRequest> {
    const [request] = await db.insert(patientRequests).values(data).returning();
    return request;
  },

  async update(
    id: string,
    data: Partial<NewPatientRequest>
  ): Promise<PatientRequest | undefined> {
    const [request] = await db
      .update(patientRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(patientRequests.id, id))
      .returning();
    return request;
  },
};
