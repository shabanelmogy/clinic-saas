import type { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated } from "../../utils/response.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { roleService } from "./role.service.js";
import type { CreateRoleInput, UpdateRoleInput, ListRolesQuery, AssignRoleInput, RemoveRoleInput } from "./role.validation.js";
import type { IdParam } from "../../utils/shared-validators.js";

export const roleController = {
  /** GET /roles */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await roleService.listRoles(
        req.query as unknown as ListRolesQuery,
        { userId: req.user!.userId, clinicId: req.user!.clinicId, permissions: req.user!.permissions },
        req.t
      );
      const meta = buildPaginationMeta(result.total, result.page, result.limit);
      sendSuccess(res, result.data, req.t("roles.retrieved"), 200, meta);
    } catch (err) { next(err); }
  },

  /** GET /roles/:id */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const result = await roleService.getRoleById(
        id,
        { userId: req.user!.userId, clinicId: req.user!.clinicId, permissions: req.user!.permissions },
        req.t
      );
      sendSuccess(res, result, req.t("roles.roleRetrieved"));
    } catch (err) { next(err); }
  },

  /** POST /roles */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await roleService.createRole(
        req.body as CreateRoleInput,
        { userId: req.user!.userId, clinicId: req.user!.clinicId, permissions: req.user!.permissions },
        req.t
      );
      sendCreated(res, result, req.t("roles.created"));
    } catch (err) { next(err); }
  },

  /** PATCH /roles/:id */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      const result = await roleService.updateRole(
        id,
        req.body as UpdateRoleInput,
        { userId: req.user!.userId, clinicId: req.user!.clinicId, permissions: req.user!.permissions },
        req.t
      );
      sendSuccess(res, result, req.t("roles.updated"));
    } catch (err) { next(err); }
  },

  /** DELETE /roles/:id */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as IdParam;
      await roleService.deleteRole(
        id,
        { userId: req.user!.userId, clinicId: req.user!.clinicId, permissions: req.user!.permissions },
        req.t
      );
      sendSuccess(res, null, req.t("roles.deleted"));
    } catch (err) { next(err); }
  },

  /** GET /roles/permissions */
  async listPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await roleService.listPermissions(
        { userId: req.user!.userId, permissions: req.user!.permissions },
        req.t
      );
      sendSuccess(res, data, req.t("roles.permissionsRetrieved"));
    } catch (err) { next(err); }
  },

  /** POST /roles/assign */
  async assignRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await roleService.assignRole(
        req.body as AssignRoleInput,
        { userId: req.user!.userId, clinicId: req.user!.clinicId, permissions: req.user!.permissions },
        req.t
      );
      sendSuccess(res, null, req.t("roles.assigned"));
    } catch (err) { next(err); }
  },

  /** POST /roles/unassign */
  async removeRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await roleService.removeRole(
        req.body as RemoveRoleInput,
        { userId: req.user!.userId, clinicId: req.user!.clinicId, permissions: req.user!.permissions },
        req.t
      );
      sendSuccess(res, null, req.t("roles.unassigned"));
    } catch (err) { next(err); }
  },

  /** GET /roles/assignments */
  async listAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page  = Number(req.query.page)  || 1;
      const limit = Number(req.query.limit) || 20;
      const staffUserId = req.query.staffUserId as string | undefined;

      const result = await roleService.listAssignments(
        { page, limit, staffUserId },
        { userId: req.user!.userId, permissions: req.user!.permissions },
        req.t
      );
      const meta = buildPaginationMeta(result.total, result.page, result.limit);
      sendSuccess(res, result.data, req.t("roles.assignmentsRetrieved"), 200, meta);
    } catch (err) { next(err); }
  },
};
