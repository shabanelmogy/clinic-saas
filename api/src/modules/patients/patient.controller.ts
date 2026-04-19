import type { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated } from "../../utils/response.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { patientService } from "./patient.service.js";
import type { CreatePatientInput, UpdatePatientInput, ListPatientsQuery } from "./patient.validation.js";
import type { IdParam } from "../../utils/shared-validators.js";

export const patientController = {
  /** GET /patients */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = { userId: req.user!.userId, permissions: req.user!.permissions };
      const result = await patientService.listPatients(req.query as unknown as ListPatientsQuery, context, req.t);
      const meta = buildPaginationMeta(result.total, result.page, result.limit);
      sendSuccess(res, result.data, req.t("patients.retrieved"), 200, meta);
    } catch (err) { next(err); }
  },

  /** GET /patients/:id */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const context = { userId: req.user!.userId, permissions: req.user!.permissions };
      const result = await patientService.getPatientById(id, context, req.t);
      sendSuccess(res, result, req.t("patients.patientRetrieved"));
    } catch (err) { next(err); }
  },

  /** POST /patients */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = { userId: req.user!.userId, permissions: req.user!.permissions };
      const result = await patientService.createPatient(req.body as CreatePatientInput, context, req.t);
      sendCreated(res, result, req.t("patients.created"));
    } catch (err) { next(err); }
  },

  /** PATCH /patients/:id */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const context = { userId: req.user!.userId, permissions: req.user!.permissions };
      const result = await patientService.updatePatient(id, req.body as UpdatePatientInput, context, req.t);
      sendSuccess(res, result, req.t("patients.updated"));
    } catch (err) { next(err); }
  },

  /** DELETE /patients/:id */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const context = { userId: req.user!.userId, permissions: req.user!.permissions };
      await patientService.deletePatient(id, context, req.t);
      sendSuccess(res, null, req.t("patients.deleted"));
    } catch (err) { next(err); }
  },
};
