import { z } from "zod";
import { paginationSchema } from "../../utils/shared-validators.js";
import type { TranslateFn } from "../../utils/i18n.js";

export const createRoleSchemas = (t: TranslateFn) => ({
  create: z.object({
    name: z
      .string()
      .min(2, t("validation.minLength", { field: "Name", min: 2 }))
      .max(100, t("validation.maxLength", { field: "Name", max: 100 })),
    description: z
      .string()
      .max(500, t("validation.maxLength", { field: "Description", max: 500 }))
      .optional(),
    // clinicId is taken from JWT — not accepted from body
    permissionIds: z
      .array(z.string().uuid(t("validation.invalidUuid")))
      .default([]),
  }),

  update: z.object({
    name: z
      .string()
      .min(2, t("validation.minLength", { field: "Name", min: 2 }))
      .max(100, t("validation.maxLength", { field: "Name", max: 100 }))
      .optional(),
    description: z
      .string()
      .max(500, t("validation.maxLength", { field: "Description", max: 500 }))
      .optional(),
    permissionIds: z
      .array(z.string().uuid(t("validation.invalidUuid")))
      .optional(),
  }),

  listQuery: paginationSchema.extend({
    search: z
      .string()
      .max(100, t("validation.maxLength", { field: "Search", max: 100 }))
      .optional(),
  }),

  assignRole: z.object({
    staffUserId: z.string().uuid(t("validation.invalidUuid")),
    roleId: z.string().uuid(t("validation.invalidUuid")),
    // Super admins can pass clinicId explicitly; clinic staff use their JWT clinicId
    clinicId: z.string().uuid(t("validation.invalidUuid")).optional(),
  }),

  removeRole: z.object({
    staffUserId: z.string().uuid(t("validation.invalidUuid")),
    roleId: z.string().uuid(t("validation.invalidUuid")),
    clinicId: z.string().uuid(t("validation.invalidUuid")).optional(),
  }),
});

export type CreateRoleInput = z.infer<ReturnType<typeof createRoleSchemas>["create"]>;
export type UpdateRoleInput = z.infer<ReturnType<typeof createRoleSchemas>["update"]>;
export type ListRolesQuery = z.infer<ReturnType<typeof createRoleSchemas>["listQuery"]>;
export type AssignRoleInput = z.infer<ReturnType<typeof createRoleSchemas>["assignRole"]>;
export type RemoveRoleInput = z.infer<ReturnType<typeof createRoleSchemas>["removeRole"]>;
