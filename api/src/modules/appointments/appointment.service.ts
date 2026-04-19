import { appointmentRepository } from "./appointment.repository.js";
import { userRepository } from "../users/user.repository.js";
import { clinicRepository } from "../clinics/clinic.repository.js";
import type {
  CreateAppointmentInput,
  UpdateAppointmentInput,
  ListAppointmentsQuery,
} from "./appointment.validation.js";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

const requirePermission = (
  userPermissions: string[],
  permission: string,
  t: TranslateFn
): void => {
  if (!userPermissions.includes(permission)) {
    throw new ForbiddenError(t("permissions.required", { permission }));
  }
};

export const appointmentService = {
  /**
   * List appointments — context-aware.
   * Patient: shows all their appointments across ALL clinics.
   * Staff: shows only appointments for their clinic.
   */
  async listAppointments(
    query: ListAppointmentsQuery,
    context: {
      userType: "patient" | "staff";
      userId: string;
      clinicId?: string;
      permissions: string[];
    },
    t: TranslateFn
  ) {
    if (context.userType === "patient") {
      // ✅ Patient: cross-clinic visibility
      const { data, total } = await appointmentRepository.findAllForPatient(
        context.userId,
        query
      );

      logger.info({
        msg: "Patient appointments listed",
        patientId: context.userId,
        count: data.length,
        total,
      });

      return { data, total, page: query.page, limit: query.limit };
    } else {
      // ✅ Staff: clinic-scoped
      const canViewAll = context.permissions.includes("appointments:view_all");
      const canViewOwn = context.permissions.includes("appointments:view_own");

      if (!canViewAll && !canViewOwn) {
        throw new ForbiddenError(
          t("permissions.oneRequired", {
            permissions: "appointments:view_all, appointments:view_own",
          })
        );
      }

      const { data, total } = await appointmentRepository.findAllForClinic(
        context.clinicId!,
        query
      );

      logger.info({
        msg: "Clinic appointments listed",
        clinicId: context.clinicId,
        count: data.length,
        total,
      });

      return { data, total, page: query.page, limit: query.limit };
    }
  },

  /**
   * Get appointment by ID — context-aware.
   */
  async getAppointmentById(
    id: string,
    context: {
      userType: "patient" | "staff";
      userId: string;
      clinicId?: string;
      permissions: string[];
    },
    t: TranslateFn
  ) {
    const appointment = await appointmentRepository.findById(id, context);
    if (!appointment) throw new NotFoundError(t("appointments.notFound"));

    // Additional permission check for staff
    if (context.userType === "staff") {
      const canViewAll = context.permissions.includes("appointments:view_all");
      const canViewOwn = context.permissions.includes("appointments:view_own");

      if (!canViewAll && !canViewOwn) {
        throw new ForbiddenError(t("appointments.noPermission"));
      }
    }

    return appointment;
  },

  /**
   * Create appointment — context-aware.
   * Patient: books with ANY clinic (must provide clinicId).
   * Staff: creates for their clinic (clinicId from JWT, must provide patientId).
   */
  async createAppointment(
    input: CreateAppointmentInput,
    context: {
      userType: "patient" | "staff";
      userId: string;
      clinicId?: string;
      permissions: string[];
    },
    t: TranslateFn
  ) {
    if (context.userType === "patient") {
      // ✅ Patient booking — must provide clinicId
      if (!input.clinicId) {
        throw new BadRequestError("clinicId is required for patient bookings");
      }

      // Verify the target clinic exists, is active and published
      const clinic = await clinicRepository.findById(input.clinicId);
      if (!clinic) throw new NotFoundError(t("appointments.clinicNotFound"));

      // Verify patient exists (themselves)
      const patient = await userRepository.findById(context.userId);
      if (!patient || !patient.isActive) {
        throw new BadRequestError(t("appointments.userInactive"));
      }

      const appointment = await appointmentRepository.create({
        patientId: context.userId, // ✅ Authenticated patient
        clinicId: input.clinicId, // ✅ Patient chooses clinic
        title: input.title,
        description: input.description,
        scheduledAt: new Date(input.scheduledAt),
        durationMinutes: input.durationMinutes,
        notes: input.notes,
      });

      logger.info({
        msg: "Appointment created by patient",
        appointmentId: appointment.id,
        patientId: context.userId,
        clinicId: input.clinicId,
      });

      return appointment;
    } else {
      // ✅ Staff creating — must provide patientId
      requirePermission(context.permissions, "appointments:create", t);

      if (!input.patientId) {
        throw new BadRequestError("patientId is required for staff bookings");
      }

      // Verify patient exists
      const patient = await userRepository.findById(input.patientId);
      if (!patient) throw new NotFoundError(t("appointments.userNotFound"));
      if (!patient.isActive) {
        throw new BadRequestError(t("appointments.userInactive"));
      }

      const appointment = await appointmentRepository.create({
        patientId: input.patientId, // ✅ Staff specifies patient
        clinicId: context.clinicId!, // ✅ Staff's clinic
        title: input.title,
        description: input.description,
        scheduledAt: new Date(input.scheduledAt),
        durationMinutes: input.durationMinutes,
        notes: input.notes,
      });

      logger.info({
        msg: "Appointment created by staff",
        appointmentId: appointment.id,
        createdBy: context.userId,
        clinicId: context.clinicId,
        patientId: input.patientId,
      });

      return appointment;
    }
  },

  /**
   * Update appointment — context-aware.
   */
  async updateAppointment(
    id: string,
    input: UpdateAppointmentInput,
    context: {
      userType: "patient" | "staff";
      userId: string;
      clinicId?: string;
      permissions: string[];
    },
    t: TranslateFn
  ) {
    if (context.userType === "staff") {
      requirePermission(context.permissions, "appointments:update", t);
    }

    const existing = await appointmentRepository.findById(id, context);
    if (!existing) throw new NotFoundError(t("appointments.notFound"));

    if (existing.status === "cancelled" || existing.status === "completed") {
      throw new BadRequestError(
        t("appointments.cannotUpdateStatus", { status: existing.status })
      );
    }

    const updateData: Partial<typeof existing> = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.scheduledAt !== undefined)
      updateData.scheduledAt = new Date(input.scheduledAt);
    if (input.durationMinutes !== undefined)
      updateData.durationMinutes = input.durationMinutes;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.notes !== undefined) updateData.notes = input.notes;

    const updated = await appointmentRepository.update(id, updateData, context);
    if (!updated) throw new NotFoundError(t("appointments.notFound"));

    logger.info({
      msg: "Appointment updated",
      appointmentId: id,
      updatedBy: context.userId,
      userType: context.userType,
      fields: Object.keys(updateData),
    });

    return updated;
  },

  /**
   * Delete appointment — context-aware.
   */
  async deleteAppointment(
    id: string,
    context: {
      userType: "patient" | "staff";
      userId: string;
      clinicId?: string;
      permissions: string[];
    },
    t: TranslateFn
  ): Promise<void> {
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
      msg: "Appointment deleted",
      appointmentId: id,
      deletedBy: context.userId,
      userType: context.userType,
      status: existing.status,
    });
  },
};
