import { z } from "zod";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export const createAuthSchemas = (t: TranslateFn) => ({
  login: z.object({
    email: z.string().email(t("validation.invalidEmail")),
    password: z.string().min(1, t("validation.required", { field: "Password" })),
    /**
     * Optional — if provided, issues a clinic-scoped staff token.
     * Absent → global token (Super Admin only).
     * ✅ clinicId from request body is the ONLY place it's accepted at login.
     *    After login, clinicId comes exclusively from the JWT.
     */
    clinicId: z.string().uuid(t("validation.invalidUuid")).optional(),
  }),

  refreshToken: z.object({
    refreshToken: z.string().min(1, t("validation.required", { field: "Refresh token" })),
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, t("validation.required", { field: "Current password" })),
    newPassword: z
      .string()
      .min(8, t("validation.minLength", { field: "New password", min: 8 }))
      .max(72, t("validation.maxLength", { field: "New password", max: 72 }))
      .regex(/[A-Z]/, t("validation.passwordRequirements"))
      .regex(/[0-9]/, t("validation.passwordRequirements")),
  }),
});

export type LoginInput = z.infer<ReturnType<typeof createAuthSchemas>["login"]>;
export type RefreshTokenInput = z.infer<ReturnType<typeof createAuthSchemas>["refreshToken"]>;
export type ChangePasswordInput = z.infer<ReturnType<typeof createAuthSchemas>["changePassword"]>;
