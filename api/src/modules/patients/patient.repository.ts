import { eq, and, ilike, count, isNull, SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { patients, type Patient, type NewPatient } from "./patient.schema.js";
import type { ListPatientsQuery } from "./patient.validation.js";

export const patientRepository = {
  /**
   * List active patients for a clinic.
   * ✅ Always scoped to clinicId — tenant isolation.
   * ✅ Excludes soft-deleted patients.
   */
  async findAllForClinic(
    clinicId: string,
    query: ListPatientsQuery
  ): Promise<{ data: Patient[]; total: number }> {
    const { page, limit, search, isActive, bloodType, gender } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [
      eq(patients.clinicId, clinicId),
      isNull(patients.deletedAt),
    ];
    if (isActive !== undefined) conditions.push(eq(patients.isActive, isActive));
    if (bloodType) conditions.push(eq(patients.bloodType, bloodType));
    if (gender) conditions.push(eq(patients.gender, gender));
    if (search) conditions.push(ilike(patients.name, `%${search}%`));

    const where = and(...conditions);

    const [data, [{ value: total }]] = await Promise.all([
      db.select().from(patients).where(where).limit(limit).offset(offset).orderBy(patients.name),
      db.select({ value: count() }).from(patients).where(where),
    ]);

    return { data, total: Number(total) };
  },

  /**
   * Find patient by ID — scoped to clinic.
   * ✅ Excludes soft-deleted patients.
   */
  async findById(id: string, clinicId: string): Promise<Patient | undefined> {
    const [patient] = await db
      .select()
      .from(patients)
      .where(and(eq(patients.id, id), eq(patients.clinicId, clinicId), isNull(patients.deletedAt)));
    return patient;
  },

  /**
   * Find patient by email within a clinic — for duplicate check before create.
   */
  async findByEmail(email: string, clinicId: string): Promise<Patient | undefined> {
    const [patient] = await db
      .select()
      .from(patients)
      .where(and(
        eq(patients.email, email.toLowerCase()),
        eq(patients.clinicId, clinicId),
        isNull(patients.deletedAt),
      ));
    return patient;
  },

  /**
   * Find patient by nationalId within a clinic — for duplicate check before create.
   */
  async findByNationalId(nationalId: string, clinicId: string): Promise<Patient | undefined> {
    const [patient] = await db
      .select()
      .from(patients)
      .where(and(
        eq(patients.nationalId, nationalId),
        eq(patients.clinicId, clinicId),
        isNull(patients.deletedAt),
      ));
    return patient;
  },

  async create(data: NewPatient): Promise<Patient> {
    const [patient] = await db.insert(patients).values(data).returning();
    return patient;
  },

  async update(id: string, clinicId: string, data: Partial<NewPatient>): Promise<Patient | undefined> {
    const [patient] = await db
      .update(patients)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(patients.id, id), eq(patients.clinicId, clinicId), isNull(patients.deletedAt)))
      .returning();
    return patient;
  },

  /**
   * Soft-delete a patient — sets deletedAt, never removes the row.
   * Appointment history and medical records remain intact.
   */
  async softDelete(id: string, clinicId: string): Promise<boolean> {
    const result = await db
      .update(patients)
      .set({ deletedAt: new Date(), updatedAt: new Date(), isActive: false })
      .where(and(eq(patients.id, id), eq(patients.clinicId, clinicId), isNull(patients.deletedAt)))
      .returning();
    return result.length > 0;
  },

  /**
   * Count active appointments for a patient — used before soft-delete.
   */
  async countActive(clinicId: string): Promise<number> {
    const [{ value }] = await db
      .select({ value: count() })
      .from(patients)
      .where(and(eq(patients.clinicId, clinicId), isNull(patients.deletedAt)));
    return Number(value);
  },
};
