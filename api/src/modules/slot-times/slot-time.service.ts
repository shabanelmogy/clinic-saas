import { slotTimeRepository } from "./slot-time.repository.js";
import { doctorRepository } from "../doctors/doctor.repository.js";
import { doctorScheduleRepository } from "../doctor-schedules/doctor-schedule.repository.js";
import type { ListSlotsQuery, GenerateSlotsInput, BookSlotInput, UpdateSlotStatusInput } from "./slot-time.validation.js";
import type { NewSlotTime } from "./slot-time.schema.js";
import { NotFoundError, ConflictError, BadRequestError, ForbiddenError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

const requirePermission = (perms: string[], perm: string, t: TranslateFn) => {
  if (!perms.includes(perm)) throw new ForbiddenError(t("permissions.required", { permission: perm }));
};

/**
 * Generate all slot start times between startTime and endTime for a given duration.
 * e.g. 09:00–17:00 with 30-min slots → [09:00, 09:30, 10:00, ..., 16:30]
 */
function generateSlotStartTimes(
  date: Date,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
  durationMinutes: number
): Array<{ start: Date; end: Date }> {
  const slots: Array<{ start: Date; end: Date }> = [];

  const startMs = (startHour * 60 + startMinute) * 60_000;
  const endMs = (endHour * 60 + endMinute) * 60_000;
  const durationMs = durationMinutes * 60_000;

  const dayBase = new Date(date);
  dayBase.setHours(0, 0, 0, 0);

  for (let ms = startMs; ms + durationMs <= endMs; ms += durationMs) {
    const start = new Date(dayBase.getTime() + ms);
    const end = new Date(dayBase.getTime() + ms + durationMs);
    slots.push({ start, end });
  }

  return slots;
}

const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

export const slotTimeService = {
  /**
   * List slots — public (available only) or staff (all statuses).
   */
  async listSlots(
    query: ListSlotsQuery,
    context: { clinicId: string; isStaff: boolean; permissions: string[] },
    t: TranslateFn
  ) {
    // Public: force status = 'available' unless staff
    const effectiveQuery = context.isStaff
      ? query
      : { ...query, status: "available" as const };

    const { data, total } = await slotTimeRepository.findAll(context.clinicId, effectiveQuery);
    return { data, total, page: query.page, limit: query.limit };
  },

  /**
   * Generate slots from doctor_schedules rules for a date range.
   * Idempotent — existing slots are skipped (onConflictDoNothing).
   * Typically called by a daily/weekly cron job.
   */
  async generateSlots(
    input: GenerateSlotsInput,
    context: { clinicId: string; userId: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "slots:generate", t);

    // Verify doctor belongs to this clinic
    const doctor = await doctorRepository.findById(input.doctorId, context.clinicId);
    if (!doctor) throw new NotFoundError(t("doctors.notFound"));

    // Load active schedule rules for this doctor
    const schedules = await doctorScheduleRepository.findAll(input.doctorId, context.clinicId);
    const activeSchedules = schedules.filter((s) => s.isActive);

    if (activeSchedules.length === 0) {
      return { generated: 0, message: "No active schedule rules found" };
    }

    const from = new Date(input.from);
    const to = new Date(input.to);

    if (to <= from) throw new BadRequestError(t("slotTimes.invalidDateRange"));

    const slotsToInsert: NewSlotTime[] = [];

    // Walk each day in the range
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);

    while (cursor <= to) {
      const dayOfWeek = cursor.getDay(); // 0=Sunday, 6=Saturday

      for (const schedule of activeSchedules) {
        if (DAY_MAP[schedule.dayOfWeek] !== dayOfWeek) continue;

        // Parse "HH:MM" time strings
        const [startH, startM] = schedule.startTime.split(":").map(Number);
        const [endH, endM] = schedule.endTime.split(":").map(Number);

        const slots = generateSlotStartTimes(
          cursor, startH, startM, endH, endM, schedule.slotDurationMinutes
        );

        for (const slot of slots) {
          // Skip slots in the past
          if (slot.start <= new Date()) continue;

          slotsToInsert.push({
            clinicId: context.clinicId,
            doctorId: input.doctorId,
            startTime: slot.start,
            endTime: slot.end,
            status: "available",
          });
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    const generated = await slotTimeRepository.bulkInsert(slotsToInsert);

    logger.info({
      msg: "Slots generated",
      doctorId: input.doctorId,
      clinicId: context.clinicId,
      attempted: slotsToInsert.length,
      inserted: generated,
      generatedBy: context.userId,
    });

    return { generated, attempted: slotsToInsert.length };
  },

  /**
   * Book a slot — atomically marks it as booked.
   * The WHERE status = 'available' in the repository prevents double-booking.
   */
  async bookSlot(
    slotId: string,
    input: BookSlotInput,
    context: { clinicId: string; userId: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "slots:book", t);

    const existing = await slotTimeRepository.findById(slotId, context.clinicId);
    if (!existing) throw new NotFoundError(t("slotTimes.notFound"));

    if (existing.status !== "available") {
      throw new ConflictError(t("slotTimes.notAvailable"));
    }

    const booked = await slotTimeRepository.book(slotId, context.clinicId, input.appointmentId);
    if (!booked) throw new ConflictError(t("slotTimes.notAvailable"));

    logger.info({
      msg: "Slot booked",
      slotId,
      appointmentId: input.appointmentId,
      clinicId: context.clinicId,
      bookedBy: context.userId,
    });

    return booked;
  },

  /**
   * Release a slot back to available — called on appointment cancellation.
   */
  async releaseSlot(
    slotId: string,
    context: { clinicId: string; userId: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "slots:book", t);

    const existing = await slotTimeRepository.findById(slotId, context.clinicId);
    if (!existing) throw new NotFoundError(t("slotTimes.notFound"));

    if (existing.status !== "booked") {
      throw new BadRequestError(t("slotTimes.notBooked"));
    }

    const released = await slotTimeRepository.release(slotId, context.clinicId);
    if (!released) throw new NotFoundError(t("slotTimes.notFound"));

    logger.info({ msg: "Slot released", slotId, clinicId: context.clinicId, releasedBy: context.userId });

    return released;
  },

  /**
   * Block or unblock a slot — staff manual action.
   */
  async updateSlotStatus(
    slotId: string,
    input: UpdateSlotStatusInput,
    context: { clinicId: string; userId: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "slots:manage", t);

    const existing = await slotTimeRepository.findById(slotId, context.clinicId);
    if (!existing) throw new NotFoundError(t("slotTimes.notFound"));

    if (existing.status === "booked") {
      throw new BadRequestError(t("slotTimes.cannotModifyBooked"));
    }

    const updated = await slotTimeRepository.updateStatus(slotId, context.clinicId, input.status);
    if (!updated) throw new NotFoundError(t("slotTimes.notFound"));

    logger.info({ msg: "Slot status updated", slotId, status: input.status, clinicId: context.clinicId });

    return updated;
  },
};
