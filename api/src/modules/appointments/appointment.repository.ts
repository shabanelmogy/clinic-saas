import { eq, and, gte, lte, count, isNull, SQL, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { appointments, appointmentHistory, type Appointment, type AppointmentHistory, type NewAppointment } from "./appointment.schema.js";
import { patients } from "../patients/patient.schema.js";
import { doctors } from "../doctors/doctor.schema.js";
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

  /**
   * Find appointment by ID with enriched patient + doctor names.
   * Returns the appointment plus resolved display names for the frontend.
   */
  async findByIdEnriched(
    id: string,
    context: { userType: "patient" | "staff"; userId: string; clinicId?: string }
  ): Promise<(Appointment & { patientName: string | null; doctorName: string | null }) | undefined> {
    const baseConditions =
      context.userType === "patient"
        ? and(eq(appointments.id, id), eq(appointments.patientId, context.userId), isNull(appointments.deletedAt))
        : and(eq(appointments.id, id), eq(appointments.clinicId, context.clinicId!), isNull(appointments.deletedAt));

    const rows = await db
      .select({
        // appointment fields
        id: appointments.id,
        clinicId: appointments.clinicId,
        patientId: appointments.patientId,
        doctorId: appointments.doctorId,
        slotId: appointments.slotId,
        title: appointments.title,
        description: appointments.description,
        scheduledAt: appointments.scheduledAt,
        durationMinutes: appointments.durationMinutes,
        status: appointments.status,
        notes: appointments.notes,
        version: appointments.version,
        deletedAt: appointments.deletedAt,
        createdAt: appointments.createdAt,
        updatedAt: appointments.updatedAt,
        // enriched
        patientName: patients.name,
        doctorName: doctors.name,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(doctors, eq(appointments.doctorId, doctors.id))
      .where(baseConditions)
      .limit(1);

    return rows[0];
  },

  /**
   * Find enriched list for clinic — includes patient + doctor names.
   */
  async findAllForClinicEnriched(
    clinicId: string,
    query: ListAppointmentsQuery
  ): Promise<{ data: (Appointment & { patientName: string | null; doctorName: string | null })[]; total: number }> {
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
      db
        .select({
          id: appointments.id,
          clinicId: appointments.clinicId,
          patientId: appointments.patientId,
          doctorId: appointments.doctorId,
          slotId: appointments.slotId,
          title: appointments.title,
          description: appointments.description,
          scheduledAt: appointments.scheduledAt,
          durationMinutes: appointments.durationMinutes,
          status: appointments.status,
          notes: appointments.notes,
          version: appointments.version,
          deletedAt: appointments.deletedAt,
          createdAt: appointments.createdAt,
          updatedAt: appointments.updatedAt,
          patientName: patients.name,
          doctorName: doctors.name,
        })
        .from(appointments)
        .leftJoin(patients, eq(appointments.patientId, patients.id))
        .leftJoin(doctors, eq(appointments.doctorId, doctors.id))
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(appointments.scheduledAt),
      db.select({ value: count() }).from(appointments).where(where),
    ]);

    return { data, total: Number(total) };
  },

  /**
   * Get appointment history (audit trail) — ordered by changedAt desc.
   */
  async findHistory(
    appointmentId: string,
    clinicId: string
  ): Promise<AppointmentHistory[]> {
    return db
      .select()
      .from(appointmentHistory)
      .where(
        and(
          eq(appointmentHistory.appointmentId, appointmentId),
          eq(appointmentHistory.clinicId, clinicId)
        )
      )
      .orderBy(desc(appointmentHistory.changedAt));
  },
};
