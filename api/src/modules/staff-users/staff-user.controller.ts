import type { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated } from "../../utils/response.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { staffUserService } from "./staff-user.service.js";
import type { CreateStaffUserInput, UpdateStaffUserInput, ListStaffUsersQuery } from "./staff-user.validation.js";
import type { IdParam } from "../../utils/shared-validators.js";

export const staffUserController = {
  /** GET /staff-users */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await staffUserService.listStaffUsers(
        req.query as unknown as ListStaffUsersQuery,
        req.user!.userId,
        req.user!.permissions,
        req.t
      );
      const meta = buildPaginationMeta(result.total, result.page, result.limit);
      sendSuccess(res, result.data, req.t("staffUsers.retrieved"), 200, meta);
    } catch (err) { next(err); }
  },

  /** GET /staff-users/:id */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const result = await staffUserService.getStaffUserById(
        id,
        req.user!.userId,
        req.user!.permissions,
        req.t
      );
      sendSuccess(res, result, req.t("staffUsers.staffUserRetrieved"));
    } catch (err) { next(err); }
  },

  /** POST /staff-users */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await staffUserService.createStaffUser(
        req.body as CreateStaffUserInput,
        req.user!.userId,
        req.user!.permissions,
        req.t
      );
      sendCreated(res, result, req.t("staffUsers.created"));
    } catch (err) { next(err); }
  },

  /** PATCH /staff-users/:id */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const result = await staffUserService.updateStaffUser(
        id,
        req.body as UpdateStaffUserInput,
        req.user!.userId,
        req.user!.permissions,
        req.t
      );
      sendSuccess(res, result, req.t("staffUsers.updated"));
    } catch (err) { next(err); }
  },

  /** DELETE /staff-users/:id */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      await staffUserService.deleteStaffUser(
        id,
        req.user!.userId,
        req.user!.permissions,
        req.t
      );
      sendSuccess(res, null, req.t("staffUsers.deleted"));
    } catch (err) { next(err); }
  },
};
