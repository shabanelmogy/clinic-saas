import { sql, eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { slotTimes } from "../slot-times/slot-time.schema.js";
import { appointments, appointmentHistory } from "./appointment.schema.js";
import { patientRepository } from "../patients/patient.repository.js";
import { slotTimeRepository } from "../slot-times/slot-time.repository.js";
import type { CreateAppointmentInput } from "./appointment.validation.js";
import type { Appointment } from "./appointment.schema.js";
import { ConflictError, NotFoundError, BadRequestError, ForbiddenError } from "../../utils/errors.js";
import { requirePermission } from "../rbac/authorize.middleware.js";
import { logger } from "../../utils/logger.js";
import type { TranslateFn } from "../../utils/i18n.js";

// ─── Context types ────────────────────────────────────────────────────────────

export type BookingContext = {
  userType: "patient" | "staff";
  userId: string;
  clinicId?: string;
  permissions: string[];
};

export type CancelContext = {
  userType: "patient" | "staff";
  userId: string;
  clinicId?: string;
  permissions: string[];
};

// ─── Result types ─────────────────────────────────────────────────────────────

export type BookingResult = {
  appointment: Appointment;
  slotId: string | null;
};

// ─── Booking Service ──────────────────────────────────────────────────────────

export const bookingService = {
  /**
   * Book an appointment — fully transactional, race-safe.
   *
   * ─── Flow ─────────────────────────────────────────────────────────────────
   *
   * WITH SLOT (slot-based booking):
   *   1. Validate permissions + inputs
   *   2. BEGIN transaction
   *   3. SELECT slot FOR UPDATE — row-level lock, blocks concurrent bookings
   *   4. Assert slot.status === 'available' — first guard
   *   5. Assert slot.clinicId === context.clinicId — tenant isolation
   *   6. INSERT appointment with slotId + scheduledAt from slot.startTime
   *   7. UPDATE slot SET status = 'booked' WHERE status = 'available' — optimistic guard
   *   8. Assert UPDATE affected 1 row — catches any race that slipped past step 4
   *   9. INSERT appointment_history (null → pending)
   *  10. COMMIT
   *
   * WITHOUT SLOT (walk-in / manual booking):
   *   1. Validate permissions + inputs (scheduledAt required)
   *   2. INSERT appointment (no slotId, scheduledAt set directly)
   *   3. INSERT appointment_history
   *
   * ─── Concurrency guarantees ───────────────────────────────────────────────
   *
   * SELECT FOR UPDATE acquires a row-level exclusive lock.
   * Any concurrent transaction trying to lock the same row will WAIT until
   * this transaction commits or rolls back.
   *
   * The UPDATE WHERE status = 'available' is a second guard — if somehow
   * two transactions both passed the FOR UPDATE check (impossible with proper
   * locking, but defensive), only one UPDATE will succeed.
   *
   * If UPDATE returns 0 rows → ROLLBACK → 409 Conflict.
   */
  async bookAppointment(
    input: CreateAppointmentInput,
    context: BookingContext,
    t: TranslateFn
  ): Promise<BookingResult> {
    // ── Pre-transaction validation ─────────────────────────────────────────

    const clinicId = _resolveClinicId(input, context, t);
    const patientId = _resolvePatientId(input, context, t);

    if (context.userType === "staff") {
      requirePermission(context.permissions, "appointments:create", t);
    }

    // Verify patient exists and is active in this clinic
    const patient = await patientRepository.findById(patientId, clinicId);
    if (!patient) throw new NotFoundError(t("appointments.userNotFound"));
    if (!patient.isActive) throw new BadRequestError(t("appointments.userInactive"));

    // ── Slot-based booking ─────────────────────────────────────────────────

    if (input.slotId) {
      return _bookWithSlot(input, context, clinicId, patientId, t);
    }

    // ── Walk-in / manual booking (no slot) ────────────────────────────────

    return _bookWithoutSlot(input, context, clinicId, patientId, t);
  },

  /**
   * Cancel an appointment — transactional slot release.
   *
   * ─── Flow ─────────────────────────────────────────────────────────────────
   *   1. Validate permissions
   *   2. BEGIN transaction
   *   3. SELECT appointment FOR UPDATE — lock the row
   *   4. Assert appointment is cancellable (not already cancelled/completed)
   *   5. UPDATE appointment SET status = 'cancelled', version = version + 1
   *      WHERE version = $currentVersion — optimistic lock guard
   *   6. If UPDATE 0 rows → concurrent update → ROLLBACK → 409
   *   7. If slotId exists → UPDATE slot SET status = 'available'
   *   8. INSERT appointment_history
   *   9. COMMIT
   */
  async cancelAppointment(
    appointmentId: string,
    reason: string | undefined,
    context: CancelContext,
    t: TranslateFn
  ): Promise<Appointment> {
    if (context.userType === "staff") {
      requirePermission(context.permissions, "appointments:update", t);
    }

    const result = await db.transaction(async (tx) => {
      // ── Step 1: Lock the appointment row ──────────────────────────────────
      const locked = await tx.execute(
        sql`
          SELECT id, status, slot_id, version, patient_id, clinic_id
          FROM appointments
          WHERE id = ${appointmentId}
            AND deleted_at IS NULL
          FOR UPDATE
        `
      );

      const row = locked.rows[0] as {
        id: string;
        status: string;
        slot_id: string | null;
        version: number;
        patient_id: string;
        clinic_id: string;
      } | undefined;

      if (!row) throw new NotFoundError(t("appointments.notFound"));

      // ── Step 2: Tenant isolation ──────────────────────────────────────────
      if (context.userType === "staff" && row.clinic_id !== context.clinicId) {
        throw new ForbiddenError(t("common.forbidden"));
      }
      if (context.userType === "patient" && row.patient_id !== context.userId) {
        throw new ForbiddenError(t("common.forbidden"));
      }

      // ── Step 3: Assert cancellable ────────────────────────────────────────
      const terminalStatuses = ["cancelled", "completed", "no_show"];
      if (terminalStatuses.includes(row.status)) {
        throw new BadRequestError(
          t("appointments.cannotUpdateStatus", { status: row.status })
        );
      }

      const previousStatus = row.status as Appointment["status"];
      const currentVersion = row.version;

      // ── Step 4: Update appointment with optimistic lock ───────────────────
      const updated = await tx
        .update(appointments)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
          version: currentVersion + 1,
        })
        .where(
          and(
            eq(appointments.id, appointmentId),
            eq(appointments.version, currentVersion) // ✅ Optimistic lock guard
          )
        )
        .returning();

      if (updated.length === 0) {
        // Another request updated this appointment concurrently
        throw new ConflictError(t("appointments.concurrentUpdate"));
      }

      const appointment = updated[0];

      // ── Step 5: Release the slot if linked ────────────────────────────────
      if (row.slot_id) {
        const slotReleased = await tx
          .update(slotTimes)
          .set({ status: "available", updatedAt: new Date() })
          .where(
            and(
              eq(slotTimes.id, row.slot_id),
              eq(slotTimes.status, "booked") // ✅ Guard — only release if booked
            )
          )
          .returning({ id: slotTimes.id });

        if (slotReleased.length === 0) {
          // Slot was already released or in unexpected state — log but don't fail
          logger.warn({
            msg: "Slot not released during cancellation — unexpected state",
            slotId: row.slot_id,
            appointmentId,
          });
        }
      }

      // ── Step 6: Append audit history ──────────────────────────────────────
      await tx.insert(appointmentHistory).values({
        appointmentId,
        clinicId: row.clinic_id,
        previousStatus,
        newStatus: "cancelled",
        changedBy: context.userType === "staff" ? context.userId : null,
        reason: reason ?? null,
        changedAt: new Date(),
      });

      return appointment;
    });

    logger.info({
      msg: "Appointment cancelled",
      appointmentId,
      cancelledBy: context.userId,
      userType: context.userType,
    });

    return result;
  },

  /**
   * Update appointment status with optimistic locking.
   * Used for confirm, complete, no_show transitions by staff.
   *
   * ─── Flow ─────────────────────────────────────────────────────────────────
   *   1. Validate permissions
   *   2. BEGIN transaction
   *   3. SELECT appointment FOR UPDATE
   *   4. Assert valid transition
   *   5. UPDATE WHERE version = $currentVersion
   *   6. If 0 rows → concurrent update → 409
   *   7. INSERT appointment_history
   *   8. COMMIT
   */
  async updateAppointmentStatus(
    appointmentId: string,
    newStatus: Appointment["status"],
    reason: string | undefined,
    context: BookingContext,
    t: TranslateFn
  ): Promise<Appointment> {
    requirePermission(context.permissions, "appointments:update", t);

    const result = await db.transaction(async (tx) => {
      // ── Lock the row ──────────────────────────────────────────────────────
      const locked = await tx.execute(
        sql`
          SELECT id, status, version, clinic_id
          FROM appointments
          WHERE id = ${appointmentId}
            AND clinic_id = ${context.clinicId!}
            AND deleted_at IS NULL
          FOR UPDATE
        `
      );

      const row = locked.rows[0] as {
        id: string;
        status: string;
        version: number;
        clinic_id: string;
      } | undefined;

      if (!row) throw new NotFoundError(t("appointments.notFound"));

      // ── Validate transition ───────────────────────────────────────────────
      _assertValidTransition(row.status as Appointment["status"], newStatus, t);

      const previousStatus = row.status as Appointment["status"];
      const currentVersion = row.version;

      // ── Update with optimistic lock ───────────────────────────────────────
      const updated = await tx
        .update(appointments)
        .set({
          status: newStatus,
          updatedAt: new Date(),
          version: currentVersion + 1,
        })
        .where(
          and(
            eq(appointments.id, appointmentId),
            eq(appointments.version, currentVersion)
          )
        )
        .returning();

      if (updated.length === 0) {
        throw new ConflictError(t("appointments.concurrentUpdate"));
      }

      // ── Audit history ─────────────────────────────────────────────────────
      await tx.insert(appointmentHistory).values({
        appointmentId,
        clinicId: context.clinicId!,
        previousStatus,
        newStatus,
        changedBy: context.userId,
        reason: reason ?? null,
        changedAt: new Date(),
      });

      return updated[0];
    });

    logger.info({
      msg: "Appointment status updated",
      appointmentId,
      from: result.status,
      to: newStatus,
      updatedBy: context.userId,
    });

    return result;
  },
};

// ─── Private helpers ──────────────────────────────────────────────────────────

function _resolveClinicId(
  input: CreateAppointmentInput,
  context: BookingContext,
  t: TranslateFn
): string {
  if (context.userType === "staff") {
    if (!context.clinicId) throw new ForbiddenError(t("auth.clinicRequired"));
    return context.clinicId;
  }
  // Patient must supply clinicId
  if (!input.clinicId) throw new BadRequestError(t("appointments.clinicRequired"));
  return input.clinicId;
}

function _resolvePatientId(
  input: CreateAppointmentInput,
  context: BookingContext,
  t: TranslateFn
): string {
  if (context.userType === "patient") return context.userId;
  if (!input.patientId) throw new BadRequestError(t("appointments.patientRequired"));
  return input.patientId;
}

async function _bookWithSlot(
  input: CreateAppointmentInput,
  context: BookingContext,
  clinicId: string,
  patientId: string,
  t: TranslateFn
): Promise<BookingResult> {
  const slotId = input.slotId!;

  const result = await db.transaction(async (tx) => {
    // ── Step 1: SELECT FOR UPDATE — exclusive row lock ─────────────────────
    //
    // This is the critical section. PostgreSQL will serialize all concurrent
    // transactions that try to lock the same slot row.
    // Only one transaction proceeds; others wait until this one commits/rolls back.
    const locked = await tx.execute(
      sql`
        SELECT id, status, clinic_id, doctor_id, start_time, end_time
        FROM slot_times
        WHERE id = ${slotId}
        FOR UPDATE
      `
    );

    const slot = locked.rows[0] as {
      id: string;
      status: string;
      clinic_id: string;
      doctor_id: string;
      start_time: Date;
      end_time: Date;
    } | undefined;

    // ── Step 2: Slot existence check ──────────────────────────────────────
    if (!slot) throw new NotFoundError(t("slotTimes.notFound"));

    // ── Step 3: Tenant isolation — slot must belong to this clinic ─────────
    if (slot.clinic_id !== clinicId) {
      throw new ForbiddenError(t("common.forbidden"));
    }

    // ── Step 4: Availability check (first guard) ───────────────────────────
    if (slot.status !== "available") {
      throw new ConflictError(t("slotTimes.notAvailable"));
    }

    // ── Step 5: Create appointment — scheduledAt from slot.start_time ──────
    const [appointment] = await tx
      .insert(appointments)
      .values({
        clinicId,
        patientId,
        doctorId: slot.doctor_id,
        slotId,
        title: input.title,
        description: input.description ?? null,
        // ✅ scheduledAt is the denorm cache — always set from slot.start_time
        scheduledAt: slot.start_time,
        durationMinutes: input.durationMinutes,
        notes: input.notes ?? null,
        status: "pending",
        version: 0,
      })
      .returning();

    // ── Step 6: Mark slot booked — optimistic guard (second guard) ─────────
    //
    // WHERE status = 'available' is redundant given the FOR UPDATE lock above,
    // but acts as a defensive double-check. If this returns 0 rows, something
    // is seriously wrong — roll back and surface a 409.
    const slotUpdated = await tx
      .update(slotTimes)
      .set({ status: "booked", updatedAt: new Date() })
      .where(
        and(
          eq(slotTimes.id, slotId),
          eq(slotTimes.status, "available") // ✅ Optimistic guard
        )
      )
      .returning({ id: slotTimes.id });

    if (slotUpdated.length === 0) {
      // This should never happen with FOR UPDATE, but if it does — abort
      throw new ConflictError(t("slotTimes.notAvailable"));
    }

    // ── Step 7: Append audit history ──────────────────────────────────────
    await tx.insert(appointmentHistory).values({
      appointmentId: appointment.id,
      clinicId,
      previousStatus: null,
      newStatus: "pending",
      changedBy: context.userType === "staff" ? context.userId : null,
      changedAt: new Date(),
    });

    return appointment;
  });

  logger.info({
    msg: "Appointment booked (slot-based)",
    appointmentId: result.id,
    slotId,
    clinicId,
    patientId,
    bookedBy: context.userId,
    userType: context.userType,
  });

  return { appointment: result, slotId };
}

async function _bookWithoutSlot(
  input: CreateAppointmentInput,
  context: BookingContext,
  clinicId: string,
  patientId: string,
  t: TranslateFn
): Promise<BookingResult> {
  // Walk-in / manual booking — scheduledAt must be provided and in the future
  if (!input.scheduledAt) {
    throw new BadRequestError(t("validation.appointments.invalidDatetime"));
  }

  const scheduledAt = new Date(input.scheduledAt);
  if (scheduledAt <= new Date()) {
    throw new BadRequestError(t("validation.appointments.mustBeFuture"));
  }

  const [appointment] = await db
    .insert(appointments)
    .values({
      clinicId,
      patientId,
      slotId: null,
      title: input.title,
      description: input.description ?? null,
      scheduledAt,
      durationMinutes: input.durationMinutes,
      notes: input.notes ?? null,
      status: "pending",
      version: 0,
    })
    .returning();

  await db.insert(appointmentHistory).values({
    appointmentId: appointment.id,
    clinicId,
    previousStatus: null,
    newStatus: "pending",
    changedBy: context.userType === "staff" ? context.userId : null,
    changedAt: new Date(),
  });

  logger.info({
    msg: "Appointment booked (walk-in)",
    appointmentId: appointment.id,
    clinicId,
    patientId,
    bookedBy: context.userId,
    userType: context.userType,
  });

  return { appointment, slotId: null };
}

// ─── Valid status transition table ────────────────────────────────────────────
//
// pending    → confirmed | cancelled
// confirmed  → completed | no_show | cancelled
// completed  → (terminal — no transitions)
// cancelled  → (terminal — no transitions)
// no_show    → (terminal — no transitions)

const VALID_TRANSITIONS: Record<string, Appointment["status"][]> = {
  pending:   ["confirmed", "cancelled"],
  confirmed: ["completed", "no_show", "cancelled"],
  completed: [],
  cancelled: [],
  no_show:   [],
};

function _assertValidTransition(
  from: Appointment["status"],
  to: Appointment["status"],
  t: TranslateFn
): void {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new BadRequestError(
      t("appointments.cannotUpdateStatus", { status: from })
    );
  }
}
