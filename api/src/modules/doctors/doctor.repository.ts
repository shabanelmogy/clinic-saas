import { eq, and, ilike, count, isNull, SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { doctors, type Doctor, type NewDoctor } from "./doctor.schema.js";
import type { ListDoctorsQuery } from "./doctor.validation.js";

// Public-safe doctor fields — omits internal flags
export type PublicDoctor = Omit<Doctor, "isActive" | "isPublished" | "deletedAt" | "createdAt" | "updatedAt">;

const publicDoctorColumns = {
  id: doctors.id,
  clinicId: doctors.clinicId,
  staffUserId: doctors.staffUserId,
  name: doctors.name,
  specialty: doctors.specialty,
  bio: doctors.bio,
  avatar: doctors.avatar,
  phone: doctors.phone,
  email: doctors.email,
  experienceYears: doctors.experienceYears,
  consultationFee: doctors.consultationFee,
} as const;

export const doctorRepository = {
  // ─── Public (marketplace) ──────────────────────────────────────────────────

  async findAllForClinicPublic(
    clinicId: string,
    query: ListDoctorsQuery
  ): Promise<{ data: PublicDoctor[]; total: number }> {
    const { page, limit, specialty, search } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [
      eq(doctors.clinicId, clinicId),
      eq(doctors.isActive, true),
      eq(doctors.isPublished, true),
      isNull(doctors.deletedAt),
    ];
    if (specialty) conditions.push(eq(doctors.specialty, specialty));
    if (search) conditions.push(ilike(doctors.name, `%${search}%`));

    const where = and(...conditions);

    const [data, [{ value: total }]] = await Promise.all([
      db.select(publicDoctorColumns).from(doctors).where(where).limit(limit).offset(offset).orderBy(doctors.name),
      db.select({ value: count() }).from(doctors).where(where),
    ]);

    return { data, total: Number(total) };
  },

  async findByIdPublic(id: string, clinicId: string): Promise<PublicDoctor | undefined> {
    const [doctor] = await db
      .select(publicDoctorColumns)
      .from(doctors)
      .where(and(
        eq(doctors.id, id),
        eq(doctors.clinicId, clinicId),
        eq(doctors.isActive, true),
        eq(doctors.isPublished, true),
        isNull(doctors.deletedAt),
      ));
    return doctor;
  },

  // ─── Internal (staff) ──────────────────────────────────────────────────────

  async findAllForClinic(
    clinicId: string,
    query: ListDoctorsQuery
  ): Promise<{ data: Doctor[]; total: number }> {
    const { page, limit, specialty, search } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [
      eq(doctors.clinicId, clinicId),
      isNull(doctors.deletedAt),
    ];
    if (specialty) conditions.push(eq(doctors.specialty, specialty));
    if (search) conditions.push(ilike(doctors.name, `%${search}%`));

    const where = and(...conditions);

    const [data, [{ value: total }]] = await Promise.all([
      db.select().from(doctors).where(where).limit(limit).offset(offset).orderBy(doctors.name),
      db.select({ value: count() }).from(doctors).where(where),
    ]);

    return { data, total: Number(total) };
  },

  async findById(id: string, clinicId: string): Promise<Doctor | undefined> {
    const [doctor] = await db
      .select()
      .from(doctors)
      .where(and(eq(doctors.id, id), eq(doctors.clinicId, clinicId), isNull(doctors.deletedAt)));
    return doctor;
  },

  async create(data: NewDoctor): Promise<Doctor> {
    const [doctor] = await db.insert(doctors).values(data).returning();
    return doctor;
  },

  async update(id: string, clinicId: string, data: Partial<NewDoctor>): Promise<Doctor | undefined> {
    const [doctor] = await db
      .update(doctors)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(doctors.id, id), eq(doctors.clinicId, clinicId), isNull(doctors.deletedAt)))
      .returning();
    return doctor;
  },

  async softDelete(id: string, clinicId: string): Promise<boolean> {
    const result = await db
      .update(doctors)
      .set({ deletedAt: new Date(), updatedAt: new Date(), isActive: false, isPublished: false })
      .where(and(eq(doctors.id, id), eq(doctors.clinicId, clinicId), isNull(doctors.deletedAt)))
      .returning();
    return result.length > 0;
  },

  async countByClinicId(clinicId: string): Promise<number> {
    const [{ value }] = await db
      .select({ value: count() })
      .from(doctors)
      .where(and(eq(doctors.clinicId, clinicId), isNull(doctors.deletedAt)));
    return Number(value);
  },
};
