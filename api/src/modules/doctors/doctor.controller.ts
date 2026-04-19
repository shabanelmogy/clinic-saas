import type { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated } from "../../utils/response.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { doctorService } from "./doctor.service.js";
import type { CreateDoctorInput, UpdateDoctorInput, ListDoctorsQuery } from "./doctor.validation.js";
import type { IdParam } from "../../utils/shared-validators.js";

export const doctorController = {
  // ─── Public ────────────────────────────────────────────────────────────────

  /** GET /clinics/:clinicId/doctors */
  async listPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { clinicId } = req.params;
      const result = await doctorService.listDoctorsPublic(clinicId, req.query as unknown as ListDoctorsQuery);
      const meta = buildPaginationMeta(result.total, result.page, result.limit);
      sendSuccess(res, result.data, req.t("doctors.retrieved"), 200, meta);
    } catch (err) { next(err); }
  },

  /** GET /clinics/:clinicId/doctors/:id */
  async getByIdPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { clinicId, id } = req.params;
      const result = await doctorService.getDoctorPublic(id, clinicId, req.t);
      sendSuccess(res, result, req.t("doctors.doctorRetrieved"));
    } catch (err) { next(err); }
  },

  // ─── Staff ─────────────────────────────────────────────────────────────────

  /** GET /doctors */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = { clinicId: req.user!.clinicId!, permissions: req.user!.permissions };
      const result = await doctorService.listDoctors(req.query as unknown as ListDoctorsQuery, context, req.t);
      const meta = buildPaginationMeta(result.total, result.page, result.limit);
      sendSuccess(res, result.data, req.t("doctors.retrieved"), 200, meta);
    } catch (err) { next(err); }
  },

  /** GET /doctors/:id */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const context = { clinicId: req.user!.clinicId!, permissions: req.user!.permissions };
      const result = await doctorService.getDoctorById(id, context, req.t);
      sendSuccess(res, result, req.t("doctors.doctorRetrieved"));
    } catch (err) { next(err); }
  },

  /** POST /doctors */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = { clinicId: req.user!.clinicId!, userId: req.user!.userId, permissions: req.user!.permissions };
      const result = await doctorService.createDoctor(req.body as CreateDoctorInput, context, req.t);
      sendCreated(res, result, req.t("doctors.created"));
    } catch (err) { next(err); }
  },

  /** PATCH /doctors/:id */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const context = { clinicId: req.user!.clinicId!, userId: req.user!.userId, permissions: req.user!.permissions };
      const result = await doctorService.updateDoctor(id, req.body as UpdateDoctorInput, context, req.t);
      sendSuccess(res, result, req.t("doctors.updated"));
    } catch (err) { next(err); }
  },

  /** DELETE /doctors/:id */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const context = { clinicId: req.user!.clinicId!, userId: req.user!.userId, permissions: req.user!.permissions };
      await doctorService.deleteDoctor(id, context, req.t);
      sendSuccess(res, null, req.t("doctors.deleted"));
    } catch (err) { next(err); }
  },
};
