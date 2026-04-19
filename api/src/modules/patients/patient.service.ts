import { patientRepository } from "./patient.repository.js";
import type { CreatePatientInput, UpdatePatientInput, ListPatientsQuery } from "./patient.validation.js";
import { NotFoundError, ConflictError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import type { TranslateFn } from "../../utils/i18n.js";
import { requirePermission } from "../rbac/authorize.middleware.js";

export const patientService = {
  async listPatients(
    query: ListPatientsQuery,
    context: { clinicId: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "patients:view", t);

    const { data, total } = await patientRepository.findAllForClinic(context.clinicId, query);

    logger.info({ msg: "Patients listed", clinicId: context.clinicId, count: data.length, total });

    return { data, total, page: query.page, limit: query.limit };
  },

  async getPatientById(
    id: string,
    context: { clinicId: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "patients:view", t);

    const patient = await patientRepository.findById(id, context.clinicId);
    if (!patient) throw new NotFoundError(t("patients.notFound"));
    return patient;
  },

  async createPatient(
    input: CreatePatientInput,
    context: { clinicId: string; userId: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "patients:create", t);

    // Duplicate email check within clinic
    if (input.email) {
      const existing = await patientRepository.findByEmail(input.email, context.clinicId);
      if (existing) throw new ConflictError(t("patients.emailExists"));
    }

    // Duplicate nationalId check within clinic
    if (input.nationalId) {
      const existing = await patientRepository.findByNationalId(input.nationalId, context.clinicId);
      if (existing) throw new ConflictError(t("patients.nationalIdExists"));
    }

    const patient = await patientRepository.create({
      ...input,
      clinicId: context.clinicId,
      email: input.email?.toLowerCase(),
    });

    logger.info({ msg: "Patient created", patientId: patient.id, clinicId: context.clinicId, createdBy: context.userId });

    return patient;
  },

  async updatePatient(
    id: string,
    input: UpdatePatientInput,
    context: { clinicId: string; userId: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "patients:update", t);

    const existing = await patientRepository.findById(id, context.clinicId);
    if (!existing) throw new NotFoundError(t("patients.notFound"));

    // Email uniqueness check if changing email
    if (input.email && input.email.toLowerCase() !== existing.email) {
      const taken = await patientRepository.findByEmail(input.email, context.clinicId);
      if (taken) throw new ConflictError(t("patients.emailExists"));
    }

    // NationalId uniqueness check if changing nationalId
    if (input.nationalId && input.nationalId !== existing.nationalId) {
      const taken = await patientRepository.findByNationalId(input.nationalId, context.clinicId);
      if (taken) throw new ConflictError(t("patients.nationalIdExists"));
    }

    const updated = await patientRepository.update(id, context.clinicId, {
      ...input,
      email: input.email?.toLowerCase(),
    });
    if (!updated) throw new NotFoundError(t("patients.notFound"));

    logger.info({ msg: "Patient updated", patientId: id, clinicId: context.clinicId, updatedBy: context.userId });

    return updated;
  },

  async deletePatient(
    id: string,
    context: { clinicId: string; userId: string; permissions: string[] },
    t: TranslateFn
  ) {
    requirePermission(context.permissions, "patients:delete", t);

    const existing = await patientRepository.findById(id, context.clinicId);
    if (!existing) throw new NotFoundError(t("patients.notFound"));

    const deleted = await patientRepository.softDelete(id, context.clinicId);
    if (!deleted) throw new NotFoundError(t("patients.notFound"));

    logger.warn({ msg: "Patient soft-deleted", patientId: id, clinicId: context.clinicId, deletedBy: context.userId });
  },
};
