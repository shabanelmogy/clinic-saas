import { sql, eq, and, isNull } from "drizzle-orm";
import { db } from "../../db/index.js";
import { doctorRequests } from "./doctor-request.schema.js";
import { doctors } from "../doctors/doctor.schema.js";
import { clinics } from "../clinics/clinic.schema.js";
import { doctorRequestRepository } from "./doctor-request.repository.js";
import type {
  CreateDoctorRequestInput,
  ListDoctorRequestsQuery,
  RejectDoctorRequestInput,
} from "./doctor-request.validation.js";
import type { DoctorRequest } from "./doctor-request.schema.js";
import type { Doctor } from "../doctors/doctor.schema.js";
import type { Clinic } from "../clinics/clinic.schema.js";
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
  ForbiddenError,
} from "../../utils/errors.js";
import { requirePermission } from "../rbac/authorize.middleware.js";
import { logger } from "../../utils/logger.js";
import type { TranslateFn } from "../../utils/i18n.js";

// ─── Context ──────────────────────────────────────────────────────────────────

type StaffContext = {
  userId: string;
  clinicId?: string;
  permissions: string[];
};

export type ApproveResult = {
  request: DoctorRequest;
  doctor: Doctor;
  clinic: Clinic;
};

// ─── Slug generator ───────────────────────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 190)
    + "-" + Date.now().toString(36);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const doctorRequestService = {
  /**
   * Submit a doctor request — public, no auth.
   *
   * type = "join"   → clinicId required, checked for duplicate pending request
   * type = "create" → clinicName required, checked for duplicate pending create
   */
  async createRequest(
    input: CreateDoctorRequestInput,
    t: TranslateFn
  ): Promise<DoctorRequest> {
    const email = input.email.toLowerCase();

    if (input.type === "join") {
      // Prevent duplicate pending join request for same email + clinic
      const existing = await doctorRequestRepository.findPendingJoinByEmail(
        email,
        input.clinicId
      );
      if (existing) throw new ConflictError(t("doctorRequests.duplicatePendingJoin"));

      const request = await doctorRequestRepository.create({
        type: "join",
        clinicId: input.clinicId,
        name: input.name,
        phone: input.phone,
        email,
        specialty: input.specialty,
        experienceYears: input.experienceYears ?? null,
        clinicName: null,
        clinicAddress: null,
        status: "pending",
      });

      logger.info({
        msg: "Doctor join request submitted",
        requestId: request.id,
        clinicId: input.clinicId,
        email,
      });

      return request;
    }

    // type = "create"
    const existing = await doctorRequestRepository.findPendingCreateByEmail(email);
    if (existing) throw new ConflictError(t("doctorRequests.duplicatePendingCreate"));

    const request = await doctorRequestRepository.create({
      type: "create",
      clinicId: null,
      name: input.name,
      phone: input.phone,
      email,
      specialty: input.specialty,
      experienceYears: input.experienceYears ?? null,
      clinicName: input.clinicName,
      clinicAddress: input.clinicAddress ?? null,
      status: "pending",
    });

    logger.info({
      msg: "Doctor create-clinic request submitted",
      requestId: request.id,
      clinicName: input.clinicName,
      email,
    });

    return request;
  },

  /**
   * List requests — staff only.
   * Clinic staff: scoped to their clinic (join requests only).
   * Super admin: all requests.
   */
  async listRequests(
    query: ListDoctorRequestsQuery,
    context: StaffContext,
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "doctors:view", t);

    const { data, total } = await doctorRequestRepository.findAll(
      query,
      context.clinicId
    );

    return { data, total, page: query.page, limit: query.limit };
  },

  /**
   * Approve a doctor request — fully transactional.
   *
   * ─── type = "join" ────────────────────────────────────────────────────────
   *   BEGIN
   *     1. SELECT request FOR UPDATE
   *     2. Assert pending
   *     3. Tenant isolation (clinic staff can only approve their clinic's requests)
   *     4. Assert clinic exists and is active
   *     5. Check duplicate doctor (email per clinic, active)
   *     6. INSERT doctor
   *     7. UPDATE request → approved
   *   COMMIT
   *
   * ─── type = "create" ──────────────────────────────────────────────────────
   *   BEGIN
   *     1. SELECT request FOR UPDATE
   *     2. Assert pending
   *     3. Only super admin (no clinicId in JWT) can approve create requests
   *     4. INSERT clinic (isActive=true, isPublished=false — needs manual publish)
   *     5. INSERT doctor linked to new clinic
   *     6. UPDATE request → approved, set clinic_id to new clinic
   *   COMMIT
   */
  async approveRequest(
    id: string,
    context: StaffContext,
    t: TranslateFn
  ): Promise<ApproveResult> {
    requirePermission(context.permissions, "doctors:create", t);

    const result = await db.transaction(async (tx) => {
      // ── Step 1: Lock the request row ──────────────────────────────────────
      const locked = await tx.execute(
        sql`
          SELECT id, type, status, clinic_id, name, phone, email,
                 specialty, experience_years, clinic_name, clinic_address
          FROM doctor_requests
          WHERE id = ${id}
          FOR UPDATE
        `
      );

      const row = locked.rows[0] as {
        id: string;
        type: "join" | "create";
        status: string;
        clinic_id: string | null;
        name: string;
        phone: string;
        email: string;
        specialty: string;
        experience_years: number | null;
        clinic_name: string | null;
        clinic_address: string | null;
      } | undefined;

      // ── Step 2: Existence ─────────────────────────────────────────────────
      if (!row) throw new NotFoundError(t("doctorRequests.notFound"));

      // ── Step 3: Must be pending ───────────────────────────────────────────
      if (row.status !== "pending") {
        throw new BadRequestError(
          t("doctorRequests.alreadyProcessed", { status: row.status })
        );
      }

      const now = new Date();

      // ══════════════════════════════════════════════════════════════════════
      // JOIN flow
      // ══════════════════════════════════════════════════════════════════════
      if (row.type === "join") {
        const clinicId = row.clinic_id;
        if (!clinicId) {
          throw new BadRequestError(t("doctorRequests.clinicIdMissing"));
        }

        // Tenant isolation — clinic staff can only approve their clinic's requests
        if (context.clinicId && context.clinicId !== clinicId) {
          throw new ForbiddenError(t("common.forbidden"));
        }

        // Assert clinic exists and is active
        const [clinic] = await tx
          .select()
          .from(clinics)
          .where(and(eq(clinics.id, clinicId), eq(clinics.isActive, true)))
          .limit(1);

        if (!clinic) throw new NotFoundError(t("doctorRequests.clinicNotFound"));

        // Duplicate doctor check — same email per clinic (active, non-deleted)
        const [existingDoctor] = await tx
          .select({ id: doctors.id })
          .from(doctors)
          .where(
            and(
              eq(doctors.email, row.email),
              eq(doctors.clinicId, clinicId),
              isNull(doctors.deletedAt)
            )
          )
          .limit(1);

        if (existingDoctor) {
          throw new ConflictError(t("doctorRequests.doctorAlreadyExists"));
        }

        // Create doctor
        const [doctor] = await tx
          .insert(doctors)
          .values({
            clinicId,
            name: row.name,
            phone: row.phone,
            email: row.email,
            specialty: row.specialty as Doctor["specialty"],
            experienceYears: row.experience_years ?? null,
            isActive: true,
            isPublished: false, // requires manual publish after onboarding
          })
          .returning();

        // Update request → approved
        const [updated] = await tx
          .update(doctorRequests)
          .set({ status: "approved", reviewedBy: context.userId, reviewedAt: now, updatedAt: now })
          .where(eq(doctorRequests.id, id))
          .returning();

        logger.info({
          msg: "Doctor join request approved",
          requestId: id,
          doctorId: doctor.id,
          clinicId,
          approvedBy: context.userId,
        });

        return { request: updated, doctor, clinic };
      }

      // ══════════════════════════════════════════════════════════════════════
      // CREATE flow
      // ══════════════════════════════════════════════════════════════════════

      // Only super admin (no clinicId in JWT) can approve clinic-creation requests
      if (context.clinicId) {
        throw new ForbiddenError(t("doctorRequests.superAdminOnly"));
      }

      if (!row.clinic_name) {
        throw new BadRequestError(t("doctorRequests.clinicNameMissing"));
      }

      // Create clinic — isPublished=false, requires manual review before going live
      const [newClinic] = await tx
        .insert(clinics)
        .values({
          name: row.clinic_name,
          slug: generateSlug(row.clinic_name),
          address: row.clinic_address ?? null,
          isActive: true,
          isPublished: false,
        })
        .returning();

      // Create doctor linked to the new clinic
      const [doctor] = await tx
        .insert(doctors)
        .values({
          clinicId: newClinic.id,
          name: row.name,
          phone: row.phone,
          email: row.email,
          specialty: row.specialty as Doctor["specialty"],
          experienceYears: row.experience_years ?? null,
          isActive: true,
          isPublished: false,
        })
        .returning();

      // Update request → approved, store the new clinic_id
      const [updated] = await tx
        .update(doctorRequests)
        .set({
          status: "approved",
          reviewedBy: context.userId,
          reviewedAt: now,
          clinicId: newClinic.id,
          updatedAt: now,
        })
        .where(eq(doctorRequests.id, id))
        .returning();

      logger.info({
        msg: "Doctor create-clinic request approved",
        requestId: id,
        doctorId: doctor.id,
        clinicId: newClinic.id,
        approvedBy: context.userId,
      });

      return { request: updated, doctor, clinic: newClinic };
    });

    return result;
  },

  /**
   * Reject a doctor request.
   * Uses SELECT FOR UPDATE to prevent concurrent approve/reject race.
   */
  async rejectRequest(
    id: string,
    input: RejectDoctorRequestInput,
    context: StaffContext,
    t: TranslateFn
  ): Promise<DoctorRequest> {
    requirePermission(context.permissions, "doctors:create", t);

    const result = await db.transaction(async (tx) => {
      const locked = await tx.execute(
        sql`
          SELECT id, status, clinic_id, type
          FROM doctor_requests
          WHERE id = ${id}
          FOR UPDATE
        `
      );

      const row = locked.rows[0] as {
        id: string;
        status: string;
        clinic_id: string | null;
        type: string;
      } | undefined;

      if (!row) throw new NotFoundError(t("doctorRequests.notFound"));

      // Tenant isolation for join requests
      if (row.type === "join" && context.clinicId && row.clinic_id !== context.clinicId) {
        throw new ForbiddenError(t("common.forbidden"));
      }

      // Only super admin can reject create requests
      if (row.type === "create" && context.clinicId) {
        throw new ForbiddenError(t("doctorRequests.superAdminOnly"));
      }

      if (row.status !== "pending") {
        throw new BadRequestError(
          t("doctorRequests.alreadyProcessed", { status: row.status })
        );
      }

      const now = new Date();
      const [updated] = await tx
        .update(doctorRequests)
        .set({
          status: "rejected",
          reviewedBy: context.userId,
          reviewedAt: now,
          rejectionReason: input.rejectionReason,
          updatedAt: now,
        })
        .where(eq(doctorRequests.id, id))
        .returning();

      return updated;
    });

    logger.warn({
      msg: "Doctor request rejected",
      requestId: id,
      rejectedBy: context.userId,
    });

    return result;
  },
};
