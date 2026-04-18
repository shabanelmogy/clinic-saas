import { eq, and, gte, lte, count, SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { appointments, type Appointment, type NewAppointment } from "./appointment.schema.js";
import type { ListAppointmentsQuery } from "./appointment.validation.js";

export const appointmentRepository = {
  /**
   * Find appointments for a PATIENT across ALL clinics.
   *
   * ✅ Filters by patientId ONLY — no clinicId filter.
   * ✅ Patient sees their appointments regardless of which clinic they belong to.
   */
  async findAllForPatient(
    patientId: string,
    query: ListAppointmentsQuery
  ): Promise<{ data: Appointment[]; total: number }> {
    const { page, limit, status, from, to } = query;
    const offset = (page - 1) * limit;

    // ✅ CRITICAL: Only filter by patientId — cross-clinic visibility
    const conditions: SQL[] = [eq(appointments.patientId, patientId)];
    if (status) conditions.push(eq(appointments.status, status));
    if (from) conditions.push(gte(appointments.scheduledAt, new Date(from)));
    if (to) conditions.push(lte(appointments.scheduledAt, new Date(to)));

    const where = and(...conditions);

    const [data, [{ value: total }]] = await Promise.all([
      db
        .select()
        .from(appointments)
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(appointments.scheduledAt),
      db.select({ value: count() }).from(appointments).where(where),
    ]);

    return { data, total: Number(total) };
  },

  /**
   * Find appointments for a CLINIC — strictly scoped to that clinic.
   *
   * ✅ ALWAYS filters by clinicId — tenant isolation.
   * ✅ Staff can optionally filter by patientId within their clinic.
   */
  async findAllForClinic(
    clinicId: string,
    query: ListAppointmentsQuery
  ): Promise<{ data: Appointment[]; total: number }> {
    const { page, limit, patientId, status, from, to } = query;
    const offset = (page - 1) * limit;

    // ✅ CRITICAL: Always start with clinicId filter
    const conditions: SQL[] = [eq(appointments.clinicId, clinicId)];
    if (patientId) conditions.push(eq(appointments.patientId, patientId));
    if (status) conditions.push(eq(appointments.status, status));
    if (from) conditions.push(gte(appointments.scheduledAt, new Date(from)));
    if (to) conditions.push(lte(appointments.scheduledAt, new Date(to)));

    const where = and(...conditions);

    const [data, [{ value: total }]] = await Promise.all([
      db
        .select()
        .from(appointments)
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(appointments.scheduledAt),
      db.select({ value: count() }).from(appointments).where(where),
    ]);

    return { data, total: Number(total) };
  },

  /**
   * Find appointment by ID — context-aware.
   *
   * Patient: checks ownership via patientId (no clinic filter).
   * Staff:   checks ownership via clinicId (tenant isolation).
   */
  async findById(
    id: string,
    context: { userType: "patient" | "staff"; userId: string; clinicId?: string }
  ): Promise<Appointment | undefined> {
    const where =
      context.userType === "patient"
        ? // ✅ Patient: own appointment, any clinic
          and(eq(appointments.id, id), eq(appointments.patientId, context.userId))
        : // ✅ Staff: appointment within their clinic
          and(eq(appointments.id, id), eq(appointments.clinicId, context.clinicId!));

    const [appointment] = await db.select().from(appointments).where(where);
    return appointment;
  },

  /**
   * Create a new appointment.
   * clinicId and patientId must both be set by the caller.
   */
  async create(data: NewAppointment): Promise<Appointment> {
    const [appointment] = await db
      .insert(appointments)
      .values(data)
      .returning();
    return appointment;
  },

  /**
   * Update an appointment — context-aware.
   */
  async update(
    id: string,
    data: Partial<NewAppointment>,
    context: { userType: "patient" | "staff"; userId: string; clinicId?: string }
  ): Promise<Appointment | undefined> {
    const where =
      context.userType === "patient"
        ? and(eq(appointments.id, id), eq(appointments.patientId, context.userId))
        : and(eq(appointments.id, id), eq(appointments.clinicId, context.clinicId!));

    const [appointment] = await db
      .update(appointments)
      .set({ ...data, updatedAt: new Date() })
      .where(where)
      .returning();
    return appointment;
  },

  /**
   * Delete an appointment — context-aware.
   */
  async delete(
    id: string,
    context: { userType: "patient" | "staff"; userId: string; clinicId?: string }
  ): Promise<boolean> {
    const where =
      context.userType === "patient"
        ? and(eq(appointments.id, id), eq(appointments.patientId, context.userId))
        : and(eq(appointments.id, id), eq(appointments.clinicId, context.clinicId!));

    const result = await db.delete(appointments).where(where).returning();
    return result.length > 0;
  },

  /**
   * Count appointments for a patient within a specific clinic.
   * Used for dependency checks before deleting a patient.
   */
  async countByPatientId(patientId: string): Promise<number> {
    const [{ value }] = await db
      .select({ value: count() })
      .from(appointments)
      .where(eq(appointments.patientId, patientId));
    return Number(value);
  },
};
