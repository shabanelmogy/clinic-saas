import type { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated } from "../../utils/response.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { userService } from "./user.service.js";
import type { CreateUserInput, UpdateUserInput, ListUsersQuery } from "./user.validation.js";
import type { IdParam } from "../../utils/shared-validators.js";

export const userController = {
  /**
   * List users — global, no clinic filter.
   * GET /api/v1/users
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListUsersQuery;
      const result = await userService.listUsers(
        query,
        req.user!.userId,
        req.user!.permissions,
        req.t
      );
      const meta = buildPaginationMeta(result.total, result.page, result.limit);
      sendSuccess(res, result.data, req.t("users.retrieved"), 200, meta);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get user by ID — global lookup.
   * GET /api/v1/users/:id
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const user = await userService.getUserById(
        id,
        req.user!.userId,
        req.user!.permissions,
        req.t
      );
      sendSuccess(res, user, req.t("users.userRetrieved"));
    } catch (err) {
      next(err);
    }
  },

  /**
   * Create user — global, no clinic scope.
   * POST /api/v1/users
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = req.body as CreateUserInput;
      const user = await userService.createUser(
        input,
        req.user!.userId,
        req.user!.permissions,
        req.t
      );
      sendCreated(res, user, req.t("users.created"));
    } catch (err) {
      next(err);
    }
  },

  /**
   * Update user — global, no clinic scope.
   * PATCH /api/v1/users/:id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const input = req.body as UpdateUserInput;
      const user = await userService.updateUser(
        id,
        input,
        req.user!.userId,
        req.user!.permissions,
        req.t
      );
      sendSuccess(res, user, req.t("users.updated"));
    } catch (err) {
      next(err);
    }
  },

  /**
   * Delete user — global, no clinic scope.
   * DELETE /api/v1/users/:id
   */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      await userService.deleteUser(
        id,
        req.user!.userId,
        req.user!.permissions,
        req.t
      );
      sendSuccess(res, null, req.t("users.deleted"));
    } catch (err) {
      next(err);
    }
  },
};
