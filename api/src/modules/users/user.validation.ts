import { z } from "zod";
import { paginationSchema } from "../../utils/shared-validators.js";

/**
 * User module — all Zod schemas live here.
 * Do NOT move these to a global validations folder.
 */

/**
 * Translation function type
 */
type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

/**
 * Create localized user validation schemas
 * 
 * @param t - Translation function from request
 * @returns Localized Zod schemas
 */
export const createUserSchemas = (t: TranslateFn) => ({
  create: z.object({
    name: z
      .string()
      .min(2, t("validation.minLength", { field: "Name", min: 2 }))
      .max(100, t("validation.maxLength", { field: "Name", max: 100 })),
    email: z.string().email(t("validation.invalidEmail")),
    password: z
      .string()
      .min(8, t("validation.minLength", { field: "Password", min: 8 }))
      .max(72, t("validation.maxLength", { field: "Password", max: 72 }))
      .regex(/[A-Z]/, t("validation.passwordRequirements"))
      .regex(/[0-9]/, t("validation.passwordRequirements")),
    phone: z
      .string()
      .max(20, t("validation.maxLength", { field: "Phone", max: 20 }))
      .optional(),
  }),

  update: z.object({
    name: z
      .string()
      .min(2, t("validation.minLength", { field: "Name", min: 2 }))
      .max(100, t("validation.maxLength", { field: "Name", max: 100 }))
      .optional(),
    email: z.string().email(t("validation.invalidEmail")).optional(),
    password: z
      .string()
      .min(8, t("validation.minLength", { field: "Password", min: 8 }))
      .max(72, t("validation.maxLength", { field: "Password", max: 72 }))
      .regex(/[A-Z]/, t("validation.passwordRequirements"))
      .regex(/[0-9]/, t("validation.passwordRequirements"))
      .optional(),
    phone: z
      .string()
      .max(20, t("validation.maxLength", { field: "Phone", max: 20 }))
      .optional(),
    isActive: z.boolean().optional(),
  }),

  listQuery: paginationSchema.extend({
    isActive: z
      .string()
      .optional()
      .transform((v: string | undefined) => {
        if (v === "true") return true;
        if (v === "false") return false;
        return undefined;
      }),
    search: z
      .string()
      .max(100, t("validation.maxLength", { field: "Search", max: 100 }))
      .optional(),
  }),
});

export type CreateUserInput = z.infer<ReturnType<typeof createUserSchemas>["create"]>;
export type UpdateUserInput = z.infer<ReturnType<typeof createUserSchemas>["update"]>;
export type ListUsersQuery = z.infer<ReturnType<typeof createUserSchemas>["listQuery"]>;
