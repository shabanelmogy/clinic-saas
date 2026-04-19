import { eq, and, gte, lte, count, isNull, SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { appointments, type Appointment, type NewAppointment } from "./appointment.schema.js";
import type { ListAppointmentsQuery } from "./appointment.validation.js";

export const appointmentRepository = {
  /**
   * Find appointments for a PATIENT across ALL clinics.
   * ✅ Filters by patientId ONLY — cross-clinic visibility.
   * ✅ Excludes soft-deleted rows.
   */
  async findAllForPatient(
    patientId: string,
    query: ListAppointmentsQuery
  ): Promise<{ data: Appointment[]; total: number }> {
    const { page, limit, status, from, to } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [
      eq(appointments.patientId, patientId),
      isNull(appointments.deletedAt),
    ];
    if (status) conditions.push(eq(appointments.status, status));
    if (from) conditions.push(gte(appointments.scheduledAt, new Date(from)));
    if (to) conditions.push(lte(appointments.scheduledAt, new Date(to)));

    const where = and(...conditions);

    const [data, [{ value: total }]] = await Promise.all([
      db.select().from(appointments).where(where).limit(limit).offset(offset).orderBy(appointments.scheduledAt),
      db.select({ value: count() }).from(appointments).where(where),
    ]);

    return { data, total: Number(total) };
  },

  /**
   * Find appointments for a CLINIC — strictly scoped.
   * ✅ ALWAYS filters by clinicId — tenant isolation.
   * ✅ Excludes soft-deleted rows.
   */
  async findAllForClinic(
    clinicId: string,
    query: ListAppointmentsQuery
  ): Promise<{ data: Appointment[]; total: number }> {
    const { page, limit, patientId, status, from, to } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [
      eq(appointments.clinicId, clinicId),
      isNull(appointments.deletedAt),
    ];
    if (patientId) conditions.push(eq(appointments.patientId, patientId));
    if (status) conditions.push(eq(appointments.status, status));
    if (from) conditions.push(gte(appointments.scheduledAt, new Date(from)));
    if (to) conditions.push(lte(appointments.scheduledAt, new Date(to)));

    const where = and(...conditions);

    const [data, [{ value: total }]] = await Promise.all([
      db.select().from(appointments).where(where).limit(limit).offset(offset).orderBy(appointments.scheduledAt),
      db.select({ value: count() }).from(appointments).where(where),
    ]);

    return { data, total: Number(total) };
  },

  /**
   * Find appointment by ID — context-aware.
   * ✅ Excludes soft-deleted rows.
   */
  async findById(
    id: string,
    context: { userType: "patient" | "staff"; userId: string; clinicId?: string }
  ): Promise<Appointment | undefined> {
    const baseConditions =
      context.userType === "patient"
        ? and(eq(appointments.id, id), eq(appointments.patientId, context.userId), isNull(appointments.deletedAt))
        : and(eq(appointments.id, id), eq(appointments.clinicId, context.clinicId!), isNull(appointments.deletedAt));

    const [appointment] = await db.select().from(appointments).where(baseConditions);
    return appointment;
  },

  async create(data: NewAppointment): Promise<Appointment> {
    const [appointment] = await db.insert(appointments).values(data).returning();
    return appointment;
  },

  async update(
    id: string,
    data: Partial<NewAppointment>,
    context: { userType: "patient" | "staff"; userId: string; clinicId?: string }
  ): Promise<Appointment | undefined> {
    const where =
      context.userType === "patient"
        ? and(eq(appointments.id, id), eq(appointments.patientId, context.userId), isNull(appointments.deletedAt))
        : and(eq(appointments.id, id), eq(appointments.clinicId, context.clinicId!), isNull(appointments.deletedAt));

    const [appointment] = await db
      .update(appointments)
      .set({ ...data, updatedAt: new Date() })
      .where(where)
      .returning();
    return appointment;
  },

  /**
   * Soft-delete an appointment — sets deletedAt, never removes the row.
   */
  async softDelete(
    id: string,
    context: { userType: "patient" | "staff"; userId: string; clinicId?: string }
  ): Promise<boolean> {
    const where =
      context.userType === "patient"
        ? and(eq(appointments.id, id), eq(appointments.patientId, context.userId), isNull(appointments.deletedAt))
        : and(eq(appointments.id, id), eq(appointments.clinicId, context.clinicId!), isNull(appointments.deletedAt));

    const result = await db
      .update(appointments)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(where)
      .returning();
    return result.length > 0;
  },

  /**
   * Count active (non-deleted) appointments for a patient.
   * Used for dependency checks.
   */
  async countByPatientId(patientId: string): Promise<number> {
    const [{ value }] = await db
      .select({ value: count() })
      .from(appointments)
      .where(and(eq(appointments.patientId, patientId), isNull(appointments.deletedAt)));
    return Number(value);
  },
};
