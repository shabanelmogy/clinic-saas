import { Router } from "express";
import { z } from "zod";
import { doctorController } from "./doctor.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorize } from "../rbac/authorize.middleware.js";
import { idParamSchema } from "../../utils/shared-validators.js";
import { createDoctorSchemas } from "./doctor.validation.js";

// ─── Public router (mounted under /clinics) ───────────────────────────────────
// ✅ Param :clinicId defined HERE — not on app.use() — so Express populates it correctly
export const publicDoctorRouter = Router({ mergeParams: true });

/**
 * @openapi
 * /clinics/{clinicId}/doctors:
 *   get:
 *     tags: [Doctors]
 *     summary: List doctors for a clinic (public marketplace)
 */
publicDoctorRouter.get(
  "/:clinicId/doctors",
  validate({ query: (t) => createDoctorSchemas(t).listQuery }),
  doctorController.listPublic
);

/**
 * @openapi
 * /clinics/{clinicId}/doctors/{id}:
 *   get:
 *     tags: [Doctors]
 *     summary: Get doctor by ID (public)
 */
publicDoctorRouter.get(
  "/:clinicId/doctors/:id",
  validate({ params: z.object({ clinicId: z.string().uuid(), id: z.string().uuid() }) }),
  doctorController.getByIdPublic
);

// ─── Staff router (mounted under /doctors) ────────────────────────────────────
const router = Router();

/**
 * @openapi
 * /doctors:
 *   get:
 *     tags: [Doctors]
 *     summary: List doctors for the authenticated clinic (staff)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: specialty
 *         in: query
 *         schema: { type: string }
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated list of doctors
 */
router.get(
  "/",
  authenticate,
  authorize("doctors:view"),
  validate({ query: (t) => createDoctorSchemas(t).listQuery }),
  doctorController.list
);

/**
 * @openapi
 * /doctors/{id}:
 *   get:
 *     tags: [Doctors]
 *     summary: Get doctor by ID (staff)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Doctor found
 *       404:
 *         description: Doctor not found
 */
router.get(
  "/:id",
  authenticate,
  authorize("doctors:view"),
  validate({ params: idParamSchema }),
  doctorController.getById
);

/**
 * @openapi
 * /doctors:
 *   post:
 *     tags: [Doctors]
 *     summary: Create a new doctor
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, specialty]
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 100, example: "Dr. Sarah Smith" }
 *               specialty:
 *                 type: string
 *                 enum: [general_practice, cardiology, dermatology, endocrinology, gastroenterology,
 *                   gynecology, hematology, nephrology, neurology, oncology, ophthalmology,
 *                   orthopedics, otolaryngology, pediatrics, psychiatry, pulmonology, radiology,
 *                   rheumatology, surgery, urology, other]
 *               staffUserId: { type: string, format: uuid }
 *               bio: { type: string }
 *               phone: { type: string, maxLength: 20 }
 *               email: { type: string, format: email }
 *               experienceYears: { type: integer, minimum: 0, maximum: 70 }
 *               consultationFee: { type: integer, minimum: 0, description: "In cents" }
 *               isPublished: { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: Doctor created
 */
router.post(
  "/",
  authenticate,
  authorize("doctors:create"),
  validate({ body: (t) => createDoctorSchemas(t).create }),
  doctorController.create
);

/**
 * @openapi
 * /doctors/{id}:
 *   patch:
 *     tags: [Doctors]
 *     summary: Update a doctor
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               specialty: { type: string }
 *               bio: { type: string }
 *               phone: { type: string }
 *               email: { type: string, format: email }
 *               experienceYears: { type: integer }
 *               consultationFee: { type: integer }
 *               isActive: { type: boolean }
 *               isPublished: { type: boolean }
 *     responses:
 *       200:
 *         description: Doctor updated
 *       404:
 *         description: Doctor not found
 */
router.patch(
  "/:id",
  authenticate,
  authorize("doctors:update"),
  validate({ params: idParamSchema, body: (t) => createDoctorSchemas(t).update }),
  doctorController.update
);

/**
 * @openapi
 * /doctors/{id}:
 *   delete:
 *     tags: [Doctors]
 *     summary: Soft-delete a doctor
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Doctor deleted
 *       404:
 *         description: Doctor not found
 */
router.delete(
  "/:id",
  authenticate,
  authorize("doctors:delete"),
  validate({ params: idParamSchema }),
  doctorController.remove
);

export default router;
