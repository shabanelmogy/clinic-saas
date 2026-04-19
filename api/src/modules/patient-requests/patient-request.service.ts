import { sql, eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { patientRequests } from "./patient-request.schema.js";
import { patients } from "../patients/patient.schema.js";
import { patientRequestRepository } from "./patient-request.repository.js";
import { bookingService } from "../appointments/booking.service.js";
import type {
  CreatePatientRequestInput,
  ListPatientRequestsQuery,
  AssignClinicInput,
  ApprovePatientRequestInput,
  RejectPatientRequestInput,
} from "./patient-request.validation.js";
import type { PatientRequest } from "./patient-request.schema.js";
import type { Appointment } from "../appointments/appointment.schema.js";
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
  clinicId?: string;   // undefined = super admin (global scope)
  permissions: string[];
};

export type ApproveResult = {
  request: PatientRequest;
  patientId: string;
  appointment: Appointment | null;
  warning: string | null;
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const patientRequestService = {
  /**
   * Submit a patient registration request — public, no auth.
   *
   * clinicId is optional. If provided, checks for a duplicate pending request
   * from the same phone in that clinic.
   */
  async createRequest(
    input: CreatePatientRequestInput,
    t: TranslateFn
  ): Promise<PatientRequest> {
    // Duplicate pending check — only when clinicId is known
    if (input.clinicId) {
      const existing = await patientRequestRepository.findPendingByPhone(
        input.phone,
        input.clinicId
      );
      if (existing) throw new ConflictError(t("patientRequests.duplicatePending"));
    }

    const request = await patientRequestRepository.create({
      clinicId: input.clinicId ?? null,
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      dateOfBirth: input.dateOfBirth ?? null,
      gender: input.gender ?? null,
      preferredSlotId: input.preferredSlotId ?? null,
      autoBook: input.autoBook,
      status: "pending",
    });

    logger.info({
      msg: "Patient request submitted",
      requestId: request.id,
      clinicId: input.clinicId ?? "unassigned",
      phone: input.phone,
    });

    return request;
  },

  /**
   * List requests — staff only.
   *
   * Clinic staff: scoped to their clinic (clinicId from JWT).
   * Super admin (no clinicId in JWT): sees all; can filter unassigned=true.
   */
  async listRequests(
    query: ListPatientRequestsQuery,
    context: StaffContext,
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "patients:view", t);

    const { data, total } = await patientRequestRepository.findAll(
      query,
      context.clinicId
    );

    return { data, total, page: query.page, limit: query.limit };
  },

  /**
   * Assign a clinic to an unassigned request — staff only.
   *
   * Only allowed when request is still pending.
   * Clinic staff can only assign their own clinic.
   * Super admin can assign any clinic.
   */
  async assignClinic(
    id: string,
    input: AssignClinicInput,
    context: StaffContext,
    t: TranslateFn
  ): Promise<PatientRequest> {
    requirePermission(context.permissions, "patients:create", t);

    // Clinic staff can only assign their own clinic
    if (context.clinicId && context.clinicId !== input.clinicId) {
      throw new ForbiddenError(t("common.forbidden"));
    }

    const request = await patientRequestRepository.findById(id, context.clinicId);
    if (!request) throw new NotFoundError(t("patientRequests.notFound"));

    if (request.status !== "pending") {
      throw new BadRequestError(
        t("patientRequests.alreadyProcessed", { status: request.status })
      );
    }

    const updated = await patientRequestRepository.update(id, {
      clinicId: input.clinicId,
    });

    logger.info({
      msg: "Clinic assigned to patient request",
      requestId: id,
      clinicId: input.clinicId,
      assignedBy: context.userId,
    });

    return updated!;
  },

  /**
   * Approve a patient request — fully transactional.
   *
   * ─── Phase 1: Transaction (atomic) ────────────────────────────────────────
   *   BEGIN
   *     1. SELECT request FOR UPDATE — prevents concurrent approve/reject
   *     2. Assert status = 'pending'
   *     3. Assert clinic_id IS NOT NULL — cannot approve without a clinic
   *     4. Tenant isolation — clinic staff can only approve their clinic's requests
   *     5. Check duplicate patient (phone + clinicId)
   *     6. INSERT patient
   *     7. UPDATE request → approved
   *   COMMIT
   *
   * ─── Phase 2: Optional booking (outside transaction) ──────────────────────
   *   bookingService has its own transaction with SELECT FOR UPDATE on the slot.
   *   Keeping it outside prevents holding the request lock while waiting for
   *   the slot lock — avoids potential deadlock under concurrent approvals.
   *
   *   If booking fails → patient was already created → return warning, not error.
   */
  async approveRequest(
    id: string,
    input: ApprovePatientRequestInput,
    context: StaffContext,
    t: TranslateFn
  ): Promise<ApproveResult> {
    requirePermission(context.permissions, "patients:create", t);

    // ── Phase 1: Transaction ───────────────────────────────────────────────

    const { patientId, updatedRequest } = await db.transaction(async (tx) => {
      // Step 1: Lock the request row
      const locked = await tx.execute(
        sql`
          SELECT id, status, clinic_id, name, phone, email,
                 date_of_birth, gender, preferred_slot_id, auto_book
          FROM patient_requests
          WHERE id = ${id}
          FOR UPDATE
        `
      );

      const row = locked.rows[0] as {
        id: string;
        status: string;
        clinic_id: string | null;
        name: string;
        phone: string;
        email: string | null;
        date_of_birth: string | null;
        gender: string | null;
        preferred_slot_id: string | null;
        auto_book: boolean;
      } | undefined;

      // Step 2: Existence
      if (!row) throw new NotFoundError(t("patientRequests.notFound"));

      // Step 3: Must be pending
      if (row.status !== "pending") {
        throw new BadRequestError(
          t("patientRequests.alreadyProcessed", { status: row.status })
        );
      }

      // Step 4: Clinic must be assigned
      if (!row.clinic_id) {
        throw new BadRequestError(t("patientRequests.clinicRequired"));
      }

      // Step 5: Tenant isolation — clinic staff can only approve their clinic
      if (context.clinicId && row.clinic_id !== context.clinicId) {
        throw new ForbiddenError(t("common.forbidden"));
      }

      const clinicId = row.clinic_id;

      // Step 6: Duplicate patient check (phone is unique key per clinic)
      const [existingPatient] = await tx
        .select({ id: patients.id })
        .from(patients)
        .where(
          and(
            eq(patients.phone, row.phone),
            eq(patients.clinicId, clinicId)
          )
        )
        .limit(1);

      if (existingPatient) {
        throw new ConflictError(t("patientRequests.patientAlreadyExists"));
      }

      // Step 7: Create patient
      const [newPatient] = await tx
        .insert(patients)
        .values({
          clinicId,
          name: row.name,
          phone: row.phone,
          email: row.email ?? null,
          dateOfBirth: row.date_of_birth ?? null,
          gender: (row.gender as typeof patients.$inferInsert["gender"]) ?? null,
          isActive: true,
        })
        .returning({ id: patients.id });

      // Step 8: Update request → approved
      // Allow overriding slot/autoBook at approval time
      const now = new Date();
      const [updated] = await tx
        .update(patientRequests)
        .set({
          status: "approved",
          reviewedBy: context.userId,
          reviewedAt: now,
          preferredSlotId: input.preferredSlotId ?? row.preferred_slot_id,
          autoBook: input.autoBook ?? row.auto_book,
          updatedAt: now,
        })
        .where(eq(patientRequests.id, id))
        .returning();

      return { patientId: newPatient.id, updatedRequest: updated };
    });

    logger.info({
      msg: "Patient request approved",
      requestId: id,
      patientId,
      clinicId: updatedRequest.clinicId,
      approvedBy: context.userId,
    });

    // ── Phase 2: Optional booking ──────────────────────────────────────────

    const shouldBook =
      updatedRequest.autoBook && updatedRequest.preferredSlotId != null;

    if (!shouldBook) {
      return { request: updatedRequest, patientId, appointment: null, warning: null };
    }

    try {
      const { appointment } = await bookingService.bookAppointment(
        {
          patientId,
          clinicId: updatedRequest.clinicId!,
          slotId: updatedRequest.preferredSlotId!,
          title: `Appointment for ${updatedRequest.name}`,
          durationMinutes: 60,
          // scheduledAt will be derived from slot.start_time inside bookingService
          scheduledAt: new Date().toISOString(), // placeholder — overridden by slot
        },
        {
          userType: "staff",
          userId: context.userId,
          clinicId: updatedRequest.clinicId!,
          permissions: context.permissions,
        },
        t
      );

      logger.info({
        msg: "Auto-booking created on approval",
        requestId: id,
        patientId,
        appointmentId: appointment.id,
        slotId: updatedRequest.preferredSlotId,
      });

      return { request: updatedRequest, patientId, appointment, warning: null };
    } catch (err) {
      // Slot unavailable or any booking error — patient was created, just warn
      const warning =
        err instanceof ConflictError
          ? t("patientRequests.slotUnavailable")
          : t("patientRequests.bookingFailed");

      logger.warn({
        msg: "Auto-booking failed after approval — patient created, slot skipped",
        requestId: id,
        patientId,
        slotId: updatedRequest.preferredSlotId,
        error: err instanceof Error ? err.message : String(err),
      });

      return { request: updatedRequest, patientId, appointment: null, warning };
    }
  },

  /**
   * Reject a patient request.
   * Uses SELECT FOR UPDATE to prevent concurrent approve/reject race.
   */
  async rejectRequest(
    id: string,
    input: RejectPatientRequestInput,
    context: StaffContext,
    t: TranslateFn
  ): Promise<PatientRequest> {
    requirePermission(context.permissions, "patients:create", t);

    const result = await db.transaction(async (tx) => {
      const locked = await tx.execute(
        sql`
          SELECT id, status, clinic_id
          FROM patient_requests
          WHERE id = ${id}
          FOR UPDATE
        `
      );

      const row = locked.rows[0] as {
        id: string;
        status: string;
        clinic_id: string | null;
      } | undefined;

      if (!row) throw new NotFoundError(t("patientRequests.notFound"));

      // Tenant isolation — clinic staff can only reject their clinic's requests
      if (context.clinicId && row.clinic_id !== context.clinicId) {
        throw new ForbiddenError(t("common.forbidden"));
      }

      if (row.status !== "pending") {
        throw new BadRequestError(
          t("patientRequests.alreadyProcessed", { status: row.status })
        );
      }

      const now = new Date();
      const [updated] = await tx
        .update(patientRequests)
        .set({
          status: "rejected",
          reviewedBy: context.userId,
          reviewedAt: now,
          rejectionReason: input.rejectionReason,
          updatedAt: now,
        })
        .where(eq(patientRequests.id, id))
        .returning();

      return updated;
    });

    logger.warn({
      msg: "Patient request rejected",
      requestId: id,
      clinicId: result.clinicId,
      rejectedBy: context.userId,
    });

    return result;
  },
};
