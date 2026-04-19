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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 100, example: "John Doe" }
 *               phone: { type: string, maxLength: 20, example: "+1-555-0100" }
 *               email: { type: string, format: email, example: "john@example.com" }
 *               dateOfBirth: { type: string, format: date, example: "1985-03-15" }
 *               gender: { type: string, enum: [male, female, other] }
 *               bloodType: { type: string, enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] }
 *               allergies: { type: string, example: "Penicillin" }
 *               medicalNotes: { type: string, example: "Hypertension" }
 *               emergencyContactName: { type: string, example: "Jane Doe" }
 *               emergencyContactPhone: { type: string, example: "+1-555-0200" }
 *               address: { type: string, example: "123 Main St, New York" }
 *               nationalId: { type: string, example: "ID123456" }
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 100 }
 *               phone: { type: string, maxLength: 20 }
 *               email: { type: string, format: email }
 *               dateOfBirth: { type: string, format: date }
 *               gender: { type: string, enum: [male, female, other] }
 *               bloodType: { type: string, enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] }
 *               allergies: { type: string }
 *               medicalNotes: { type: string }
 *               emergencyContactName: { type: string }
 *               emergencyContactPhone: { type: string }
 *               address: { type: string }
 *               nationalId: { type: string }
 *               isActive: { type: boolean }
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
