import { doctorScheduleRepository } from "./doctor-schedule.repository.js";
import { doctorRepository } from "../doctors/doctor.repository.js";
import { slotTimeRepository } from "../slot-times/slot-time.repository.js";
import type { UpsertScheduleInput } from "./doctor-schedule.validation.js";
import { NotFoundError, ConflictError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import type { TranslateFn } from "../../utils/i18n.js";
import { requirePermission } from "../rbac/authorize.middleware.js";

export const doctorScheduleService = {
  /**
   * Get schedules — public (active only).
   */
  async getSchedulesPublic(doctorId: string, clinicId: string, t: TranslateFn) {
    const doctor = await doctorRepository.findByIdPublic(doctorId, clinicId);
    if (!doctor) throw new NotFoundError(t("doctors.notFound"));
    return doctorScheduleRepository.findAllPublic(doctorId, clinicId);
  },

  /**
   * Get schedules — staff (all, including inactive).
   */
  async getSchedules(
    doctorId: string,
    context: { clinicId: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "doctors:view", t);
    const doctor = await doctorRepository.findById(doctorId, context.clinicId);
    if (!doctor) throw new NotFoundError(t("doctors.notFound"));
    return doctorScheduleRepository.findAll(doctorId, context.clinicId);
  },

  /**
   * Upsert a schedule rule — validates time ordering before saving.
   */
  async upsertSchedule(
    doctorId: string,
    input: UpsertScheduleInput,
    context: { clinicId: string; userId: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "doctors:update", t);

    const doctor = await doctorRepository.findById(doctorId, context.clinicId);
    if (!doctor) throw new NotFoundError(t("doctors.notFound"));

    if (input.startTime >= input.endTime) {
      throw new ConflictError(t("doctors.invalidScheduleTime"));
    }

    const schedule = await doctorScheduleRepository.upsert({
      doctorId,
      clinicId: context.clinicId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      slotDurationMinutes: input.slotDurationMinutes,
      maxAppointments: input.maxAppointments,
      isActive: input.isActive,
    });

    logger.info({ msg: "Doctor schedule upserted", doctorId, day: input.dayOfWeek, clinicId: context.clinicId, updatedBy: context.userId });
    return schedule;
  },

  /**
   * Delete a schedule rule.
   * Also cleans up future available slots for that doctor (they are now invalid).
   */
  async deleteSchedule(
    doctorId: string,
    day: string,
    context: { clinicId: string; userId: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "doctors:update", t);

    const doctor = await doctorRepository.findById(doctorId, context.clinicId);
    if (!doctor) throw new NotFoundError(t("doctors.notFound"));

    const deleted = await doctorScheduleRepository.delete(doctorId, context.clinicId, day);
    if (!deleted) throw new NotFoundError(t("doctors.scheduleNotFound"));

    // Clean up future available slots that were generated from this rule
    const cleaned = await slotTimeRepository.deleteFutureAvailable(doctorId, context.clinicId);

    logger.info({ msg: "Doctor schedule deleted", doctorId, day, clinicId: context.clinicId, slotsRemoved: cleaned, deletedBy: context.userId });
  },
};
