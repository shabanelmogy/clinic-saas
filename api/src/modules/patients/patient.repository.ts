import { eq, and, ilike, count, isNull, SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { patients, type Patient, type NewPatient } from "./patient.schema.js";
import type { ListPatientsQuery } from "./patient.validation.js";

export const patientRepository = {
  /**
   * List all active patients — global, no clinic scope.
   */
  async findAll(query: ListPatientsQuery): Promise<{ data: Patient[]; total: number }> {
    const { page, limit, search, isActive, bloodType, gender } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [isNull(patients.deletedAt)];
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

  async findById(id: string): Promise<Patient | undefined> {
    const [patient] = await db
      .select()
      .from(patients)
      .where(and(eq(patients.id, id), isNull(patients.deletedAt)));
    return patient;
  },

  async findByEmail(email: string): Promise<Patient | undefined> {
    const [patient] = await db
      .select()
      .from(patients)
      .where(and(eq(patients.email, email.toLowerCase()), isNull(patients.deletedAt)));
    return patient;
  },

  async findByPhone(phone: string): Promise<Patient | undefined> {
    const [patient] = await db
      .select()
      .from(patients)
      .where(and(eq(patients.phone, phone), isNull(patients.deletedAt)));
    return patient;
  },

  async findByNationalId(nationalId: string): Promise<Patient | undefined> {
    const [patient] = await db
      .select()
      .from(patients)
      .where(and(eq(patients.nationalId, nationalId), isNull(patients.deletedAt)));
    return patient;
  },

  async create(data: NewPatient): Promise<Patient> {
    const [patient] = await db.insert(patients).values(data).returning();
    return patient;
  },

  async update(id: string, data: Partial<NewPatient>): Promise<Patient | undefined> {
    const [patient] = await db
      .update(patients)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(patients.id, id), isNull(patients.deletedAt)))
      .returning();
    return patient;
  },

  async softDelete(id: string): Promise<boolean> {
    const result = await db
      .update(patients)
      .set({ deletedAt: new Date(), updatedAt: new Date(), isActive: false })
      .where(and(eq(patients.id, id), isNull(patients.deletedAt)))
      .returning();
    return result.length > 0;
  },
};
