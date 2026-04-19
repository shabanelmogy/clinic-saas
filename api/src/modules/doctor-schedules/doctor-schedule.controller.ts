import type { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../utils/response.js";
import { doctorScheduleService } from "./doctor-schedule.service.js";
import type { UpsertScheduleInput } from "./doctor-schedule.validation.js";

export const doctorScheduleController = {
  /** GET /clinics/:clinicId/doctors/:doctorId/schedules — public */
  async listPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { clinicId, doctorId } = req.params;
      const result = await doctorScheduleService.getSchedulesPublic(doctorId, clinicId, req.t);
      sendSuccess(res, result, req.t("doctors.schedulesRetrieved"));
    } catch (err) { next(err); }
  },

  /** GET /doctors/:doctorId/schedules — staff */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { doctorId } = req.params;
      const context = { clinicId: req.user!.clinicId!, permissions: req.user!.permissions };
      const result = await doctorScheduleService.getSchedules(doctorId, context, req.t);
      sendSuccess(res, result, req.t("doctors.schedulesRetrieved"));
    } catch (err) { next(err); }
  },

  /** PUT /doctors/:doctorId/schedules — staff */
  async upsert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { doctorId } = req.params;
      const context = { clinicId: req.user!.clinicId!, userId: req.user!.userId, permissions: req.user!.permissions };
      const result = await doctorScheduleService.upsertSchedule(doctorId, req.body as UpsertScheduleInput, context, req.t);
      sendSuccess(res, result, req.t("doctors.scheduleUpdated"));
    } catch (err) { next(err); }
  },

  /** DELETE /doctors/:doctorId/schedules/:day — staff */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { doctorId, day } = req.params;
      const context = { clinicId: req.user!.clinicId!, userId: req.user!.userId, permissions: req.user!.permissions };
      await doctorScheduleService.deleteSchedule(doctorId, day, context, req.t);
      sendSuccess(res, null, req.t("doctors.scheduleDeleted"));
    } catch (err) { next(err); }
  },
};
