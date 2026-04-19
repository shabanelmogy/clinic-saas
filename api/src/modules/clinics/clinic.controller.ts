import type { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../utils/response.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { clinicService } from "./clinic.service.js";
import type { UpdateClinicInput, ListClinicsQuery } from "./clinic.validation.js";
import type { IdParam } from "../../utils/shared-validators.js";

export const clinicController = {
  /**
   * List published clinics — public marketplace.
   * GET /api/v1/clinics
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await clinicService.listClinics(
        req.query as unknown as ListClinicsQuery
      );

      const meta = buildPaginationMeta(result.total, result.page, result.limit);
      sendSuccess(res, result.data, req.t("clinics.retrieved"), 200, meta);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get clinic by ID — public.
   * GET /api/v1/clinics/:id
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const result = await clinicService.getClinicById(id, req.t);
      sendSuccess(res, result, req.t("clinics.clinicRetrieved"));
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get own clinic — staff only.
   * GET /api/v1/clinics/me
   */
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clinicId = req.user!.clinicId;
      if (!clinicId) {
        sendSuccess(res, null, req.t("clinics.notFound"), 404);
        return;
      }

      const context = {
        clinicId,
        permissions: req.user!.permissions,
      };

      const result = await clinicService.getOwnClinic(context, req.t);
      sendSuccess(res, result, req.t("clinics.clinicRetrieved"));
    } catch (err) {
      next(err);
    }
  },

  /**
   * Update own clinic — staff only.
   * PATCH /api/v1/clinics/me
   */
  async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clinicId = req.user!.clinicId;
      if (!clinicId) {
        sendSuccess(res, null, req.t("clinics.notFound"), 404);
        return;
      }

      const context = {
        clinicId,
        userId: req.user!.userId,
        permissions: req.user!.permissions,
      };

      const result = await clinicService.updateClinic(
        req.body as UpdateClinicInput,
        context,
        req.t
      );

      sendSuccess(res, result, req.t("clinics.updated"));
    } catch (err) {
      next(err);
    }
  },
};
