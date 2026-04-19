import { clinicRepository } from "./clinic.repository.js";
import type { UpdateClinicInput, ListClinicsQuery } from "./clinic.validation.js";
import { NotFoundError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import type { TranslateFn } from "../../utils/i18n.js";
import { requirePermission } from "../rbac/authorize.middleware.js";

export const clinicService = {
  /**
   * List clinics — public marketplace.
   * Repository enforces isPublished=true AND isActive=true.
   */
  async listClinics(query: ListClinicsQuery) {
    const { data, total } = await clinicRepository.findAll(query);
    logger.info({ msg: "Clinics listed", count: data.length, total });
    return { data, total, page: query.page, limit: query.limit };
  },

  /**
   * Get clinic by ID — public.
   * Only returns active + published clinics.
   */
  async getClinicById(id: string, t: TranslateFn) {
    const clinic = await clinicRepository.findById(id);
    if (!clinic) throw new NotFoundError(t("clinics.notFound"));
    return clinic;
  },

  /**
   * Get own clinic — staff only, returns full clinic record from JWT clinicId.
   */
  async getOwnClinic(
    context: { clinicId: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "clinic:view", t);

    const clinic = await clinicRepository.findByIdInternal(context.clinicId);
    if (!clinic || !clinic.isActive) throw new NotFoundError(t("clinics.notFound"));

    return clinic;
  },

  /**
   * Update clinic — staff only, scoped to their clinic.
   */
  async updateClinic(
    input: UpdateClinicInput,
    context: { clinicId: string; userId: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "clinic:update", t);

    const existing = await clinicRepository.findByIdInternal(context.clinicId);
    if (!existing || !existing.isActive) throw new NotFoundError(t("clinics.notFound"));

    const updated = await clinicRepository.update(context.clinicId, input);
    if (!updated) throw new NotFoundError(t("clinics.notFound"));

    logger.info({
      msg: "Clinic updated",
      clinicId: context.clinicId,
      updatedBy: context.userId,
      fields: Object.keys(input),
    });

    return updated;
  },
};
