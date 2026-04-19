import { eq, ilike, and, count, SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { clinics, type Clinic, type NewClinic } from "./clinic.schema.js";
import type { ListClinicsQuery } from "./clinic.validation.js";

// Fields safe to return on public endpoints — omits internal state
export type PublicClinic = Omit<Clinic, "isActive" | "isPublished" | "createdAt" | "updatedAt" | "deletedAt">;

const publicColumns = {
  id: clinics.id,
  name: clinics.name,
  slug: clinics.slug,
  description: clinics.description,
  address: clinics.address,
  phone: clinics.phone,
  email: clinics.email,
  website: clinics.website,
  logo: clinics.logo,
} as const;

export const clinicRepository = {
  /**
   * Find all clinics — public marketplace listing.
   * Always filters isPublished=true AND isActive=true for public calls.
   */
  async findAll(
    query: ListClinicsQuery
  ): Promise<{ data: PublicClinic[]; total: number }> {
    const { page, limit, search } = query;
    const offset = (page - 1) * limit;

    // Public listing: always enforce published + active
    const conditions: SQL[] = [
      eq(clinics.isPublished, true),
      eq(clinics.isActive, true),
    ];
    if (search) conditions.push(ilike(clinics.name, `%${search}%`));

    const where = and(...conditions);

    const [data, [{ value: total }]] = await Promise.all([
      db.select(publicColumns).from(clinics).where(where).limit(limit).offset(offset).orderBy(clinics.name),
      db.select({ value: count() }).from(clinics).where(where),
    ]);

    return { data, total: Number(total) };
  },

  /**
   * Find clinic by ID — public: only returns active+published clinics.
   * Staff path uses findByIdInternal.
   */
  async findById(id: string): Promise<PublicClinic | undefined> {
    const [clinic] = await db
      .select(publicColumns)
      .from(clinics)
      .where(and(eq(clinics.id, id), eq(clinics.isPublished, true), eq(clinics.isActive, true)));
    return clinic;
  },

  /**
   * Find clinic by ID — internal (staff/admin), no visibility filter.
   */
  async findByIdInternal(id: string): Promise<Clinic | undefined> {
    const [clinic] = await db.select().from(clinics).where(eq(clinics.id, id));
    return clinic;
  },

  /**
   * Find clinic by slug — for public marketplace pages.
   */
  async findBySlug(slug: string): Promise<PublicClinic | undefined> {
    const [clinic] = await db
      .select(publicColumns)
      .from(clinics)
      .where(and(eq(clinics.slug, slug), eq(clinics.isPublished, true), eq(clinics.isActive, true)));
    return clinic;
  },

  /**
   * Update clinic — staff only, scoped to their clinicId.
   */
  async update(id: string, data: Partial<NewClinic>): Promise<Clinic | undefined> {
    const [clinic] = await db
      .update(clinics)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clinics.id, id))
      .returning();
    return clinic;
  },

  /**
   * Get or create the system default clinic.
   *
   * Used when approving patient requests that have no clinic assigned
   * and the approver is a super admin (no clinicId in JWT).
   *
   * The default clinic is:
   *   - slug: "default-clinic"
   *   - isActive: true
   *   - isPublished: false (not visible on marketplace)
   *
   * Idempotent — safe to call multiple times.
   */
  async getOrCreateDefaultClinic(): Promise<Clinic> {
    const DEFAULT_SLUG = "default-clinic";

    const [existing] = await db
      .select()
      .from(clinics)
      .where(eq(clinics.slug, DEFAULT_SLUG));

    if (existing) return existing;

    const [created] = await db
      .insert(clinics)
      .values({
        name: "Default Clinic",
        slug: DEFAULT_SLUG,
        description: "System default clinic for unassigned patient registrations.",
        isActive: true,
        isPublished: false,
      })
      .returning();

    return created;
  },
};
