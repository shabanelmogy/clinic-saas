import { z } from "zod";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export const createAuthSchemas = (t: TranslateFn) => ({
  login: z.object({
    email: z.string().email(t("validation.invalidEmail")),
    password: z.string().min(1, t("validation.required", { field: "Password" })),
    // ✅ No clinicId — users are global, login is platform-wide
  }),

  refreshToken: z.object({
    refreshToken: z.string().min(1, t("validation.required", { field: "Refresh token" })),
  }),
});

export type LoginInput = z.infer<ReturnType<typeof createAuthSchemas>["login"]>;
export type RefreshTokenInput = z.infer<ReturnType<typeof createAuthSchemas>["refreshToken"]>;
