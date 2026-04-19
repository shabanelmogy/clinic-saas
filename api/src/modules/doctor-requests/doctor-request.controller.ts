import type { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated } from "../../utils/response.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { doctorRequestService } from "./doctor-request.service.js";
import type {
  CreateDoctorRequestInput,
  ListDoctorRequestsQuery,
  RejectDoctorRequestInput,
} from "./doctor-request.validation.js";

export const doctorRequestController = {
  /**
   * POST /doctor-requests
   * Public — no auth required.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await doctorRequestService.createRequest(
        req.body as CreateDoctorRequestInput,
        req.t
      );
      sendCreated(res, result, req.t("doctorRequests.submitted"));
    } catch (err) { next(err); }
  },

  /**
   * GET /doctor-requests
   * Staff — scoped to clinic or global for super admin.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = {
        userId: req.user!.userId,
        clinicId: req.user!.clinicId,
        permissions: req.user!.permissions,
      };
      const result = await doctorRequestService.listRequests(
        req.query as unknown as ListDoctorRequestsQuery,
        context,
        req.t
      );
      const meta = buildPaginationMeta(result.total, result.page, result.limit);
      sendSuccess(res, result.data, req.t("doctorRequests.retrieved"), 200, meta);
    } catch (err) { next(err); }
  },

  /**
   * POST /doctor-requests/:id/approve
   * Staff — creates doctor (and clinic if type=create).
   */
  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const context = {
        userId: req.user!.userId,
        clinicId: req.user!.clinicId,
        permissions: req.user!.permissions,
      };
      const result = await doctorRequestService.approveRequest(id, context, req.t);
      sendSuccess(res, result, req.t("doctorRequests.approved"));
    } catch (err) { next(err); }
  },

  /**
   * POST /doctor-requests/:id/reject
   * Staff — stores rejection reason.
   */
  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const context = {
        userId: req.user!.userId,
        clinicId: req.user!.clinicId,
        permissions: req.user!.permissions,
      };
      const result = await doctorRequestService.rejectRequest(
        id,
        req.body as RejectDoctorRequestInput,
        context,
        req.t
      );
      sendSuccess(res, result, req.t("doctorRequests.rejected"));
    } catch (err) { next(err); }
  },
};
