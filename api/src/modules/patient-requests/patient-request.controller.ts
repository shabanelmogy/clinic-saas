import type { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated } from "../../utils/response.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { patientRequestService } from "./patient-request.service.js";
import type {
  CreatePatientRequestInput,
  ListPatientRequestsQuery,
  AssignClinicInput,
  ApprovePatientRequestInput,
  RejectPatientRequestInput,
} from "./patient-request.validation.js";

export const patientRequestController = {
  /**
   * POST /patient-requests
   * Public — no auth required.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await patientRequestService.createRequest(
        req.body as CreatePatientRequestInput,
        req.t
      );
      sendCreated(res, result, req.t("patientRequests.submitted"));
    } catch (err) { next(err); }
  },

  /**
   * GET /patient-requests
   * Staff — scoped to clinic or global for super admin.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = {
        userId: req.user!.userId,
        clinicId: req.user!.clinicId,
        permissions: req.user!.permissions,
      };
      const result = await patientRequestService.listRequests(
        req.query as unknown as ListPatientRequestsQuery,
        context,
        req.t
      );
      const meta = buildPaginationMeta(result.total, result.page, result.limit);
      sendSuccess(res, result.data, req.t("patientRequests.retrieved"), 200, meta);
    } catch (err) { next(err); }
  },

  /**
   * PATCH /patient-requests/:id/assign-clinic
   * Staff — assign a clinic to an unassigned request.
   */
  async assignClinic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const context = {
        userId: req.user!.userId,
        clinicId: req.user!.clinicId,
        permissions: req.user!.permissions,
      };
      const result = await patientRequestService.assignClinic(
        id,
        req.body as AssignClinicInput,
        context,
        req.t
      );
      sendSuccess(res, result, req.t("patientRequests.clinicAssigned"));
    } catch (err) { next(err); }
  },

  /**
   * POST /patient-requests/:id/approve
   * Staff — creates patient + optional booking.
   */
  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const context = {
        userId: req.user!.userId,
        clinicId: req.user!.clinicId,
        permissions: req.user!.permissions,
      };
      const result = await patientRequestService.approveRequest(
        id,
        req.body as ApprovePatientRequestInput,
        context,
        req.t
      );
      const message = result.warning
        ? `${req.t("patientRequests.approved")} ${result.warning}`
        : result.appointment
          ? req.t("patientRequests.approvedWithBooking")
          : req.t("patientRequests.approved");

      sendSuccess(res, result, message);
    } catch (err) { next(err); }
  },

  /**
   * POST /patient-requests/:id/reject
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
      const result = await patientRequestService.rejectRequest(
        id,
        req.body as RejectPatientRequestInput,
        context,
        req.t
      );
      sendSuccess(res, result, req.t("patientRequests.rejected"));
    } catch (err) { next(err); }
  },
};
