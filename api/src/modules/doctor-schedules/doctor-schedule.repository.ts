import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { doctorSchedules, type DoctorSchedule, type NewDoctorSchedule } from "./doctor-schedule.schema.js";

export const doctorScheduleRepository = {
  /**
   * Get all active schedules for a doctor — public (for marketplace display).
   */
  async findAllPublic(doctorId: string, clinicId: string): Promise<DoctorSchedule[]> {
    return db
      .select()
      .from(doctorSchedules)
      .where(and(
        eq(doctorSchedules.doctorId, doctorId),
        eq(doctorSchedules.clinicId, clinicId),
        eq(doctorSchedules.isActive, true),
      ))
      .orderBy(doctorSchedules.dayOfWeek);
  },

  /**
   * Get all schedules for a doctor — staff (includes inactive).
   */
  async findAll(doctorId: string, clinicId: string): Promise<DoctorSchedule[]> {
    return db
      .select()
      .from(doctorSchedules)
      .where(and(eq(doctorSchedules.doctorId, doctorId), eq(doctorSchedules.clinicId, clinicId)))
      .orderBy(doctorSchedules.dayOfWeek);
  },

  /**
   * Upsert a schedule rule — insert or update on (doctorId, dayOfWeek).
   */
  async upsert(data: NewDoctorSchedule): Promise<DoctorSchedule> {
    const [schedule] = await db
      .insert(doctorSchedules)
      .values(data)
      .onConflictDoUpdate({
        target: [doctorSchedules.doctorId, doctorSchedules.dayOfWeek],
        set: {
          startTime: data.startTime,
          endTime: data.endTime,
          slotDurationMinutes: data.slotDurationMinutes,
          maxAppointments: data.maxAppointments,
          isActive: data.isActive,
          updatedAt: new Date(),
        },
      })
      .returning();
    return schedule;
  },

  /**
   * Hard-delete a schedule rule — schedule rules are config, not records.
   * Future generated slots for this day should be cleaned up separately.
   */
  async delete(doctorId: string, clinicId: string, day: string): Promise<boolean> {
    const result = await db
      .delete(doctorSchedules)
      .where(and(
        eq(doctorSchedules.doctorId, doctorId),
        eq(doctorSchedules.clinicId, clinicId),
        eq(doctorSchedules.dayOfWeek, day as DoctorSchedule["dayOfWeek"]),
      ))
      .returning();
    return result.length > 0;
  },
};
