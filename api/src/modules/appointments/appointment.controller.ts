import type { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated } from "../../utils/response.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { appointmentService } from "./appointment.service.js";
import type {
  CreateAppointmentInput,
  UpdateAppointmentInput,
  ListAppointmentsQuery,
  CancelAppointmentInput,
} from "./appointment.validation.js";
import type { IdParam } from "../../utils/shared-validators.js";

export const appointmentController = {
  /** GET /appointments */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = {
        userType: req.user!.userType,
        userId: req.user!.userId,
        clinicId: req.user!.clinicId,
        permissions: req.user!.permissions,
      };
      const result = await appointmentService.listAppointments(
        req.query as unknown as ListAppointmentsQuery,
        context,
        req.t
      );
      const meta = buildPaginationMeta(result.total, result.page, result.limit);
      sendSuccess(res, result.data, req.t("appointments.retrieved"), 200, meta);
    } catch (err) { next(err); }
  },

  /** GET /appointments/:id */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const context = {
        userType: req.user!.userType,
        userId: req.user!.userId,
        clinicId: req.user!.clinicId,
        permissions: req.user!.permissions,
      };
      const result = await appointmentService.getAppointmentById(id, context, req.t);
      sendSuccess(res, result, req.t("appointments.appointmentRetrieved"));
    } catch (err) { next(err); }
  },

  /** POST /appointments */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = {
        userType: req.user!.userType,
        userId: req.user!.userId,
        clinicId: req.user!.clinicId,
        permissions: req.user!.permissions,
      };
      const result = await appointmentService.createAppointment(
        req.body as CreateAppointmentInput,
        context,
        req.t
      );
      sendCreated(res, result, req.t("appointments.created"));
    } catch (err) { next(err); }
  },

  /** PATCH /appointments/:id */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const context = {
        userType: req.user!.userType,
        userId: req.user!.userId,
        clinicId: req.user!.clinicId,
        permissions: req.user!.permissions,
      };
      const result = await appointmentService.updateAppointment(
        id,
        req.body as UpdateAppointmentInput,
        context,
        req.t
      );
      sendSuccess(res, result, req.t("appointments.updated"));
    } catch (err) { next(err); }
  },

  /** POST /appointments/:id/cancel */
  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const context = {
        userType: req.user!.userType,
        userId: req.user!.userId,
        clinicId: req.user!.clinicId,
        permissions: req.user!.permissions,
      };
      const result = await appointmentService.cancelAppointment(
        id,
        (req.body as CancelAppointmentInput).reason,
        context,
        req.t
      );
      sendSuccess(res, result, req.t("appointments.cancelled"));
    } catch (err) { next(err); }
  },

  /** DELETE /appointments/:id */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const context = {
        userType: req.user!.userType,
        userId: req.user!.userId,
        clinicId: req.user!.clinicId,
        permissions: req.user!.permissions,
      };
      await appointmentService.deleteAppointment(id, context, req.t);
      sendSuccess(res, null, req.t("appointments.deleted"));
    } catch (err) { next(err); }
  },
};
