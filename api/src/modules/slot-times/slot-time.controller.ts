import type { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated } from "../../utils/response.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { slotTimeService } from "./slot-time.service.js";
import type { ListSlotsQuery, GenerateSlotsInput, UpdateSlotStatusInput } from "./slot-time.validation.js";
import type { IdParam } from "../../utils/shared-validators.js";

export const slotTimeController = {
  /**
   * GET /slot-times
   * Public: returns available slots only.
   * Staff: returns all statuses.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isStaff = req.user?.userType === "staff";
      const context = {
        clinicId: isStaff ? req.user!.clinicId! : (req.query.clinicId as string),
        isStaff,
        permissions: req.user?.permissions ?? [],
      };
      const result = await slotTimeService.listSlots(
        req.query as unknown as ListSlotsQuery,
        context,
        req.t
      );
      const meta = buildPaginationMeta(result.total, result.page, result.limit);
      sendSuccess(res, result.data, req.t("slotTimes.retrieved"), 200, meta);
    } catch (err) { next(err); }
  },

  /**
   * POST /slot-times/generate
   * Staff: generate slots from schedule rules for a date range.
   */
  async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = {
        clinicId: req.user!.clinicId!,
        userId: req.user!.userId,
        permissions: req.user!.permissions,
      };
      const result = await slotTimeService.generateSlots(
        req.body as GenerateSlotsInput,
        context,
        req.t
      );
      sendCreated(res, result, req.t("slotTimes.generated"));
    } catch (err) { next(err); }
  },

  /**
   * POST /slot-times/:id/book
   * Staff: book a slot for an appointment.
   */
  async book(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const context = {
        clinicId: req.user!.clinicId!,
        userId: req.user!.userId,
        permissions: req.user!.permissions,
      };
      const result = await slotTimeService.bookSlot(id, context, req.t);
      sendSuccess(res, result, req.t("slotTimes.booked"));
    } catch (err) { next(err); }
  },

  /**
   * POST /slot-times/:id/release
   * Staff: release a booked slot back to available.
   */
  async release(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const context = {
        clinicId: req.user!.clinicId!,
        userId: req.user!.userId,
        permissions: req.user!.permissions,
      };
      const result = await slotTimeService.releaseSlot(id, context, req.t);
      sendSuccess(res, result, req.t("slotTimes.released"));
    } catch (err) { next(err); }
  },

  /**
   * PATCH /slot-times/:id/status
   * Staff: block or unblock a slot.
   */
  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const context = {
        clinicId: req.user!.clinicId!,
        userId: req.user!.userId,
        permissions: req.user!.permissions,
      };
      const result = await slotTimeService.updateSlotStatus(
        id,
        req.body as UpdateSlotStatusInput,
        context,
        req.t
      );
      sendSuccess(res, result, req.t("slotTimes.updated"));
    } catch (err) { next(err); }
  },
};
