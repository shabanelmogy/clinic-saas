import { Router } from "express";
import { doctorRequestController } from "./doctor-request.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorize } from "../rbac/authorize.middleware.js";
import { requestIdParamSchema, createDoctorRequestSchemas } from "./doctor-request.validation.js";

const router = Router();

/**
 * @openapi
 * /doctor-requests:
 *   post:
 *     tags: [DoctorRequests]
 *     summary: Submit a doctor registration request
 *     description: |
 *       Public — no authentication required.
 *
 *       **type = "join"**: Doctor wants to join an existing clinic.
 *       `clinicId` is required.
 *
 *       **type = "create"**: Doctor wants to create a new clinic.
 *       `clinicName` is required. A super admin must approve.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 required: [type, clinicId, name, phone, email, specialty]
 *                 properties:
 *                   type: { type: string, enum: [join] }
 *                   clinicId: { type: string, format: uuid }
 *                   name: { type: string }
 *                   phone: { type: string }
 *                   email: { type: string, format: email }
 *                   specialty: { type: string }
 *                   experienceYears: { type: integer }
 *               - type: object
 *                 required: [type, clinicName, name, phone, email, specialty]
 *                 properties:
 *                   type: { type: string, enum: [create] }
 *                   clinicName: { type: string }
 *                   clinicAddress: { type: string }
 *                   name: { type: string }
 *                   phone: { type: string }
 *                   email: { type: string, format: email }
 *                   specialty: { type: string }
 *                   experienceYears: { type: integer }
 *     responses:
 *       201:
 *         description: Request submitted — pending staff review
 *       409:
 *         description: Duplicate pending request
 */
router.post(
  "/",
  validate({ body: (t) => createDoctorRequestSchemas(t).create }),
  doctorRequestController.create
);

/**
 * @openapi
 * /doctor-requests:
 *   get:
 *     tags: [DoctorRequests]
 *     summary: List doctor requests
 *     description: |
 *       Clinic staff: sees only join requests for their clinic.
 *       Super admin: sees all requests (join + create).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [pending, approved, rejected] }
 *       - name: type
 *         in: query
 *         schema: { type: string, enum: [join, create] }
 *     responses:
 *       200:
 *         description: Paginated list of requests
 */
router.get(
  "/",
  authenticate,
  authorize("doctors:view"),
  validate({ query: (t) => createDoctorRequestSchemas(t).listQuery }),
  doctorRequestController.list
);

/**
 * @openapi
 * /doctor-requests/{id}/approve:
 *   post:
 *     tags: [DoctorRequests]
 *     summary: Approve a doctor request
 *     description: |
 *       **join**: Creates the doctor record in the existing clinic.
 *       Clinic staff can approve join requests for their own clinic.
 *
 *       **create**: Creates the clinic first, then the doctor.
 *       Only super admin (no clinicId in JWT) can approve create requests.
 *
 *       Both flows use SELECT FOR UPDATE to prevent double-approval.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Approved — doctor (and clinic if type=create) created
 *       400:
 *         description: Already processed
 *       403:
 *         description: Insufficient permissions for this request type
 *       409:
 *         description: Doctor with this email already exists in the clinic
 */
router.post(
  "/:id/approve",
  authenticate,
  authorize("doctors:create"),
  validate({ params: requestIdParamSchema }),
  doctorRequestController.approve
);

/**
 * @openapi
 * /doctor-requests/{id}/reject:
 *   post:
 *     tags: [DoctorRequests]
 *     summary: Reject a doctor request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rejectionReason]
 *             properties:
 *               rejectionReason: { type: string, maxLength: 500 }
 *     responses:
 *       200:
 *         description: Request rejected
 *       400:
 *         description: Already processed
 *       404:
 *         description: Request not found
 */
router.post(
  "/:id/reject",
  authenticate,
  authorize("doctors:create"),
  validate({
    params: requestIdParamSchema,
    body: (t) => createDoctorRequestSchemas(t).reject,
  }),
  doctorRequestController.reject
);

export default router;
