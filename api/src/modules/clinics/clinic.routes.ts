import { Router } from "express";
import { clinicController } from "./clinic.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorize } from "../rbac/authorize.middleware.js";
import { idParamSchema } from "../../utils/shared-validators.js";
import { createClinicSchemas } from "./clinic.validation.js";

const router = Router();

/**
 * @openapi
 * /clinics:
 *   get:
 *     tags: [Clinics]
 *     summary: List published clinics
 *     description: Public marketplace listing — returns only published, active clinics.
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: search
 *         in: query
 *         description: Search by clinic name
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated list of clinics
 */
router.get(
  "/",
  validate({ query: (t) => createClinicSchemas(t).listQuery }),
  clinicController.list
);

/**
 * @openapi
 * /clinics/me:
 *   get:
 *     tags: [Clinics]
 *     summary: Get own clinic
 *     description: Returns the authenticated staff member's clinic.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Clinic details
 *       403:
 *         description: Insufficient permissions
 */
router.get(
  "/me",
  authenticate,
  authorize("clinic:view"),
  clinicController.getMe
);

/**
 * @openapi
 * /clinics/me:
 *   patch:
 *     tags: [Clinics]
 *     summary: Update own clinic
 *     description: Update the authenticated staff member's clinic settings.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateClinicBody'
 *     responses:
 *       200:
 *         description: Clinic updated
 *       403:
 *         description: Insufficient permissions
 *       422:
 *         description: Validation error
 */
router.patch(
  "/me",
  authenticate,
  authorize("clinic:update"),
  validate({ body: (t) => createClinicSchemas(t).update }),
  clinicController.updateMe
);

/**
 * @openapi
 * /clinics/{id}:
 *   get:
 *     tags: [Clinics]
 *     summary: Get clinic by ID
 *     description: Public — returns any clinic by ID.
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Clinic found
 *       404:
 *         description: Clinic not found
 *       422:
 *         description: Invalid UUID
 */
router.get(
  "/:id",
  validate({ params: idParamSchema }),
  clinicController.getById
);

export default router;
