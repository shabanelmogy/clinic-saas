import { Router } from "express";
import { patientController } from "./patient.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorize } from "../rbac/authorize.middleware.js";
import { idParamSchema } from "../../utils/shared-validators.js";
import { createPatientSchemas } from "./patient.validation.js";

const router = Router();

/**
 * @openapi
 * /patients:
 *   get:
 *     tags: [Patients]
 *     summary: List patients for the authenticated clinic
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *       - name: isActive
 *         in: query
 *         schema: { type: string, enum: [true, false] }
 *     responses:
 *       200:
 *         description: Paginated list of patients
 */
router.get(
  "/",
  authenticate,
  authorize("patients:view"),
  validate({ query: (t) => createPatientSchemas(t).listQuery }),
  patientController.list
);

/**
 * @openapi
 * /patients/{id}:
 *   get:
 *     tags: [Patients]
 *     summary: Get patient by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Patient found
 *       404:
 *         description: Patient not found
 */
router.get(
  "/:id",
  authenticate,
  authorize("patients:view"),
  validate({ params: idParamSchema }),
  patientController.getById
);

/**
 * @openapi
 * /patients:
 *   post:
 *     tags: [Patients]
 *     summary: Create a new patient
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Patient created
 *       409:
 *         description: Email or national ID already exists in this clinic
 */
router.post(
  "/",
  authenticate,
  authorize("patients:create"),
  validate({ body: (t) => createPatientSchemas(t).create }),
  patientController.create
);

/**
 * @openapi
 * /patients/{id}:
 *   patch:
 *     tags: [Patients]
 *     summary: Update a patient
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Patient updated
 *       404:
 *         description: Patient not found
 */
router.patch(
  "/:id",
  authenticate,
  authorize("patients:update"),
  validate({ params: idParamSchema, body: (t) => createPatientSchemas(t).update }),
  patientController.update
);

/**
 * @openapi
 * /patients/{id}:
 *   delete:
 *     tags: [Patients]
 *     summary: Soft-delete a patient
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Patient deleted
 *       404:
 *         description: Patient not found
 */
router.delete(
  "/:id",
  authenticate,
  authorize("patients:delete"),
  validate({ params: idParamSchema }),
  patientController.remove
);

export default router;
