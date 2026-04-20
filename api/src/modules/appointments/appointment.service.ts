import { appointmentRepository } from "./appointment.repository.js";
import { bookingService } from "./booking.service.js";
import type {
  CreateAppointmentInput,
  UpdateAppointmentInput,
  ListAppointmentsQuery,
} from "./appointment.validation.js";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import type { TranslateFn } from "../../utils/i18n.js";
import { requirePermission } from "../rbac/authorize.middleware.js";

type Context = {
  userType: "patient" | "staff";
  userId: string;
  clinicId?: string;
  permissions: string[];
};

export const appointmentService = {
  /**
   * List appointments — context-aware.
   * Patient: all their appointments across ALL clinics (cross-clinic visibility).
   * Staff: only appointments for their clinic (tenant-scoped).
   */
  async listAppointments(
    query: ListAppointmentsQuery,
    context: Context,
    t: TranslateFn
  ) {
    if (context.userType === "patient") {
      const { data, total } = await appointmentRepository.findAllForPatient(
        context.userId,
        query
      );
      logger.info({ msg: "Patient appointments listed", patientId: context.userId, count: data.length });
      return { data, total, page: query.page, limit: query.limit };
    }

    // Staff
    const canViewAll = context.permissions.includes("appointments:view_all");
    const canViewOwn = context.permissions.includes("appointments:view_own");
    if (!canViewAll && !canViewOwn) {
      throw new ForbiddenError(
        t("permissions.oneRequired", { permissions: "appointments:view_all, appointments:view_own" })
      );
    }

    const { data, total } = await appointmentRepository.findAllForClinic(
      context.clinicId!,
      query
    );
    logger.info({ msg: "Clinic appointments listed", clinicId: context.clinicId, count: data.length });
    return { data, total, page: query.page, limit: query.limit };
  },

  /**
   * Get appointment by ID — context-aware.
   */
  async getAppointmentById(id: string, context: Context, t: TranslateFn) {
    if (context.userType === "staff") {
      const canView = context.permissions.includes("appointments:view_all") ||
                      context.permissions.includes("appointments:view_own");
      if (!canView) throw new ForbiddenError(t("appointments.noPermission"));
    }

    const appointment = await appointmentRepository.findById(id, context);
    if (!appointment) throw new NotFoundError(t("appointments.notFound"));
    return appointment;
  },

  /**
   * Create / book appointment — delegates to bookingService.
   *
   * If input.slotId is provided → transactional slot-based booking (SELECT FOR UPDATE).
   * If no slotId → walk-in / manual booking (no slot lock needed).
   */
  async createAppointment(
    input: CreateAppointmentInput,
    context: Context,
    t: TranslateFn
  ) {
    const { appointment } = await bookingService.bookAppointment(input, context, t);
    return appointment;
  },

  /**
   * Update appointment fields (title, description, notes, scheduledAt, durationMinutes).
   * Status transitions are handled separately by updateStatus.
   */
  async updateAppointment(
    id: string,
    input: UpdateAppointmentInput,
    context: Context,
    t: TranslateFn
  ) {
    if (context.userType === "staff") {
      requirePermission(context.permissions, "appointments:update", t);
    }

    const existing = await appointmentRepository.findById(id, context);
    if (!existing) throw new NotFoundError(t("appointments.notFound"));

    const terminalStatuses = ["cancelled", "completed", "no_show"];
    if (terminalStatuses.includes(existing.status)) {
      throw new BadRequestError(
        t("appointments.cannotUpdateStatus", { status: existing.status })
      );
    }

    // Status transitions go through bookingService (with history + optimistic lock)
    if (input.status !== undefined && input.status !== existing.status) {
      return bookingService.updateAppointmentStatus(
        id,
        input.status,
        undefined,
        context,
        t
      );
    }

    // Field-only update — no status change, no history entry needed
    const updateData: Record<string, unknown> = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.scheduledAt !== undefined) updateData.scheduledAt = new Date(input.scheduledAt);
    if (input.durationMinutes !== undefined) updateData.durationMinutes = input.durationMinutes;
    if (input.notes !== undefined) updateData.notes = input.notes;

    const updated = await appointmentRepository.update(id, updateData, context);
    if (!updated) throw new NotFoundError(t("appointments.notFound"));

    logger.info({
      msg: "Appointment fields updated",
      appointmentId: id,
      updatedBy: context.userId,
      fields: Object.keys(updateData),
    });

    return updated;
  },

  /**
   * Cancel appointment — delegates to bookingService (transactional slot release).
   */
  async cancelAppointment(
    id: string,
    reason: string | undefined,
    context: Context,
    t: TranslateFn
  ) {
    return bookingService.cancelAppointment(id, reason, context, t);
  },

  /**
   * Soft-delete appointment — only for non-confirmed appointments.
   */
  async deleteAppointment(id: string, context: Context, t: TranslateFn): Promise<void> {
    if (context.userType === "staff") {
      requirePermission(context.permissions, "appointments:delete", t);
    }

    const existing = await appointmentRepository.findById(id, context);
    if (!existing) throw new NotFoundError(t("appointments.notFound"));

    if (existing.status === "confirmed") {
      throw new BadRequestError(t("appointments.cannotDeleteConfirmed"));
    }

    const deleted = await appointmentRepository.softDelete(id, context);
    if (!deleted) throw new NotFoundError(t("appointments.notFound"));

    logger.warn({
      msg: "Appointment soft-deleted",
      appointmentId: id,
      deletedBy: context.userId,
      status: existing.status,
    });
  },

  /**
   * Get appointment by ID with enriched patient + doctor names.
   */
  async getAppointmentByIdEnriched(id: string, context: Context, t: TranslateFn) {
    if (context.userType === "staff") {
      const canView = context.permissions.includes("appointments:view_all") ||
                      context.permissions.includes("appointments:view_own");
      if (!canView) throw new ForbiddenError(t("appointments.noPermission"));
    }

    const appointment = await appointmentRepository.findByIdEnriched(id, context);
    if (!appointment) throw new NotFoundError(t("appointments.notFound"));
    return appointment;
  },

  /**
   * List appointments with enriched patient + doctor names (staff only).
   */
  async listAppointmentsEnriched(
    query: ListAppointmentsQuery,
    context: Context,
    t: TranslateFn
  ) {
    const canViewAll = context.permissions.includes("appointments:view_all");
    const canViewOwn = context.permissions.includes("appointments:view_own");
    if (!canViewAll && !canViewOwn) {
      throw new ForbiddenError(
        t("permissions.oneRequired", { permissions: "appointments:view_all, appointments:view_own" })
      );
    }

    const { data, total } = await appointmentRepository.findAllForClinicEnriched(
      context.clinicId!,
      query
    );
    return { data, total, page: query.page, limit: query.limit };
  },

  /**
   * Get appointment history (audit trail).
   */
  async getAppointmentHistory(id: string, context: Context, t: TranslateFn) {
    if (context.userType === "staff") {
      const canView = context.permissions.includes("appointments:view_all") ||
                      context.permissions.includes("appointments:view_own");
      if (!canView) throw new ForbiddenError(t("appointments.noPermission"));
    }

    const appointment = await appointmentRepository.findById(id, context);
    if (!appointment) throw new NotFoundError(t("appointments.notFound"));

    return appointmentRepository.findHistory(id, appointment.clinicId);
  },
};
