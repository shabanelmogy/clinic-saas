import { z } from "zod";
import { paginationSchema } from "../../utils/shared-validators.js";
import type { TranslateFn } from "../../utils/i18n.js";

export const createClinicSchemas = (t: TranslateFn) => ({
  update: z.object({
    name: z
      .string()
      .min(2, t("validation.minLength", { field: "Name", min: 2 }))
      .max(200, t("validation.maxLength", { field: "Name", max: 200 }))
      .optional(),
    description: z
      .string()
      .max(2000, t("validation.maxLength", { field: "Description", max: 2000 }))
      .optional(),
    address: z
      .string()
      .max(500, t("validation.maxLength", { field: "Address", max: 500 }))
      .optional(),
    phone: z
      .string()
      .max(20, t("validation.maxLength", { field: "Phone", max: 20 }))
      .optional(),
    email: z.string().email(t("validation.invalidEmail")).optional(),
    website: z
      .string()
      .url(t("validation.clinics.invalidUrl"))
      .max(255, t("validation.maxLength", { field: "Website", max: 255 }))
      .optional(),
    logo: z
      .string()
      .url(t("validation.clinics.invalidUrl"))
      .max(500, t("validation.maxLength", { field: "Logo", max: 500 }))
      .optional(),
    isPublished: z.boolean().optional(),
  }),

  listQuery: paginationSchema.extend({
    search: z
      .string()
      .max(100, t("validation.maxLength", { field: "Search", max: 100 }))
      .optional(),
  }),
});

export type UpdateClinicInput = z.infer<ReturnType<typeof createClinicSchemas>["update"]>;
export type ListClinicsQuery = z.infer<ReturnType<typeof createClinicSchemas>["listQuery"]>;
