import { doctorRepository } from "./doctor.repository.js";
import type { CreateDoctorInput, UpdateDoctorInput, ListDoctorsQuery } from "./doctor.validation.js";
import { NotFoundError, ForbiddenError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

const requirePermission = (perms: string[], perm: string, t: TranslateFn) => {
  if (!perms.includes(perm)) throw new ForbiddenError(t("permissions.required", { permission: perm }));
};

export const doctorService = {
  // ─── Public (marketplace) ──────────────────────────────────────────────────

  async listDoctorsPublic(clinicId: string, query: ListDoctorsQuery) {
    const { data, total } = await doctorRepository.findAllForClinicPublic(clinicId, query);
    return { data, total, page: query.page, limit: query.limit };
  },

  async getDoctorPublic(id: string, clinicId: string, t: TranslateFn) {
    const doctor = await doctorRepository.findByIdPublic(id, clinicId);
    if (!doctor) throw new NotFoundError(t("doctors.notFound"));
    return doctor;
  },

  // ─── Staff (clinic-scoped) ─────────────────────────────────────────────────

  async listDoctors(
    query: ListDoctorsQuery,
    context: { clinicId: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "doctors:view", t);
    const { data, total } = await doctorRepository.findAllForClinic(context.clinicId, query);
    return { data, total, page: query.page, limit: query.limit };
  },

  async getDoctorById(
    id: string,
    context: { clinicId: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "doctors:view", t);
    const doctor = await doctorRepository.findById(id, context.clinicId);
    if (!doctor) throw new NotFoundError(t("doctors.notFound"));
    return doctor;
  },

  async createDoctor(
    input: CreateDoctorInput,
    context: { clinicId: string; userId: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "doctors:create", t);
    const doctor = await doctorRepository.create({ ...input, clinicId: context.clinicId });
    logger.info({ msg: "Doctor created", doctorId: doctor.id, clinicId: context.clinicId, createdBy: context.userId });
    return doctor;
  },

  async updateDoctor(
    id: string,
    input: UpdateDoctorInput,
    context: { clinicId: string; userId: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "doctors:update", t);
    const existing = await doctorRepository.findById(id, context.clinicId);
    if (!existing) throw new NotFoundError(t("doctors.notFound"));
    const updated = await doctorRepository.update(id, context.clinicId, input);
    if (!updated) throw new NotFoundError(t("doctors.notFound"));
    logger.info({ msg: "Doctor updated", doctorId: id, clinicId: context.clinicId, updatedBy: context.userId });
    return updated;
  },

  async deleteDoctor(
    id: string,
    context: { clinicId: string; userId: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "doctors:delete", t);
    const existing = await doctorRepository.findById(id, context.clinicId);
    if (!existing) throw new NotFoundError(t("doctors.notFound"));
    const deleted = await doctorRepository.softDelete(id, context.clinicId);
    if (!deleted) throw new NotFoundError(t("doctors.notFound"));
    logger.warn({ msg: "Doctor deleted", doctorId: id, clinicId: context.clinicId, deletedBy: context.userId });
  },
};
