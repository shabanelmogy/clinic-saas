import { patientRepository } from "./patient.repository.js";
import type { CreatePatientInput, UpdatePatientInput, ListPatientsQuery } from "./patient.validation.js";
import { NotFoundError, ConflictError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import type { TranslateFn } from "../../utils/i18n.js";
import { requirePermission } from "../rbac/authorize.middleware.js";

// ─── Context — no clinicId, patients are global ───────────────────────────────
type Context = { userId: string; permissions: string[] };

export const patientService = {
  async listPatients(query: ListPatientsQuery, context: Context, t: TranslateFn) {
    requirePermission(context.permissions, "patients:view", t);
    const { data, total } = await patientRepository.findAll(query);
    logger.info({ msg: "Patients listed", count: data.length, total });
    return { data, total, page: query.page, limit: query.limit };
  },

  async getPatientById(id: string, context: Context, t: TranslateFn) {
    requirePermission(context.permissions, "patients:view", t);
    const patient = await patientRepository.findById(id);
    if (!patient) throw new NotFoundError(t("patients.notFound"));
    return patient;
  },

  async createPatient(input: CreatePatientInput, context: Context, t: TranslateFn) {
    requirePermission(context.permissions, "patients:create", t);

    if (input.email) {
      const existing = await patientRepository.findByEmail(input.email);
      if (existing) throw new ConflictError(t("patients.emailExists"));
    }
    if (input.nationalId) {
      const existing = await patientRepository.findByNationalId(input.nationalId);
      if (existing) throw new ConflictError(t("patients.nationalIdExists"));
    }

    const patient = await patientRepository.create({
      ...input,
      email: input.email?.toLowerCase(),
    });

    logger.info({ msg: "Patient created", patientId: patient.id, createdBy: context.userId });
    return patient;
  },

  async updatePatient(id: string, input: UpdatePatientInput, context: Context, t: TranslateFn) {
    requirePermission(context.permissions, "patients:update", t);

    const existing = await patientRepository.findById(id);
    if (!existing) throw new NotFoundError(t("patients.notFound"));

    if (input.email && input.email.toLowerCase() !== existing.email) {
      const taken = await patientRepository.findByEmail(input.email);
      if (taken) throw new ConflictError(t("patients.emailExists"));
    }
    if (input.nationalId && input.nationalId !== existing.nationalId) {
      const taken = await patientRepository.findByNationalId(input.nationalId);
      if (taken) throw new ConflictError(t("patients.nationalIdExists"));
    }

    const updated = await patientRepository.update(id, {
      ...input,
      email: input.email?.toLowerCase(),
    });
    if (!updated) throw new NotFoundError(t("patients.notFound"));

    logger.info({ msg: "Patient updated", patientId: id, updatedBy: context.userId });
    return updated;
  },

  async deletePatient(id: string, context: Context, t: TranslateFn) {
    requirePermission(context.permissions, "patients:delete", t);

    const existing = await patientRepository.findById(id);
    if (!existing) throw new NotFoundError(t("patients.notFound"));

    const deleted = await patientRepository.softDelete(id);
    if (!deleted) throw new NotFoundError(t("patients.notFound"));

    logger.warn({ msg: "Patient soft-deleted", patientId: id, deletedBy: context.userId });
  },
};
