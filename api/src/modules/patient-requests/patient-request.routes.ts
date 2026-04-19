import { Router } from "express";
import { patientRequestController } from "./patient-request.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorize } from "../rbac/authorize.middleware.js";
import { requestIdParamSchema, createPatientRequestSchemas } from "./patient-request.validation.js";

const router = Router();

/**
 * @openapi
 * /patient-requests:
 *   post:
 *     tags: [PatientRequests]
 *     summary: Submit a patient registration request
 *     description: |
 *       Public — no authentication required.
 *       clinicId is optional: the patient may not know which clinic to register with.
 *       Staff will review and assign a clinic if missing before approving.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phone]
 *             properties:
 *               name: { type: string }
 *               phone: { type: string }
 *               email: { type: string, format: email }
 *               dateOfBirth: { type: string, format: date }
 *               gender: { type: string, enum: [male, female, other] }
 *               clinicId: { type: string, format: uuid }
 *               preferredSlotId: { type: string, format: uuid }
 *               autoBook: { type: boolean, default: false }
 *     responses:
 *       201:
 *         description: Request submitted — pending staff review
 *       409:
 *         description: A pending request from this phone already exists for this clinic
 */
router.post(
  "/",
  validate({ body: (t) => createPatientRequestSchemas(t).create }),
  patientRequestController.create
);

/**
 * @openapi
 * /patient-requests:
 *   get:
 *     tags: [PatientRequests]
 *     summary: List patient requests
 *     description: |
 *       Clinic staff: scoped to their clinic.
 *       Super admin (no clinicId in JWT): sees all requests.
 *       Use ?status=pending for the approval queue.
 *       Use ?unassigned=true to see requests with no clinic assigned.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [pending, approved, rejected] }
 *       - name: unassigned
 *         in: query
 *         description: Show only requests with no clinic assigned (super admin only)
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Paginated list of requests
 */
router.get(
  "/",
  authenticate,
  authorize("patients:view"),
  validate({ query: (t) => createPatientRequestSchemas(t).listQuery }),
  patientRequestController.list
);

/**
 * @openapi
 * /patient-requests/{id}/assign-clinic:
 *   patch:
 *     tags: [PatientRequests]
 *     summary: Assign a clinic to an unassigned request
 *     description: |
 *       Clinic staff can only assign their own clinic.
 *       Super admin can assign any clinic.
 *       Only allowed while request is still pending.
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
 *             required: [clinicId]
 *             properties:
 *               clinicId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Clinic assigned
 *       400:
 *         description: Request already processed
 *       403:
 *         description: Cannot assign a different clinic
 *       404:
 *         description: Request not found
 */
router.patch(
  "/:id/assign-clinic",
  authenticate,
  authorize("patients:create"),
  validate({
    params: requestIdParamSchema,
    body: (t) => createPatientRequestSchemas(t).assignClinic,
  }),
  patientRequestController.assignClinic
);

/**
 * @openapi
 * /patient-requests/{id}/approve:
 *   post:
 *     tags: [PatientRequests]
 *     summary: Approve a patient request
 *     description: |
 *       Transactionally creates the patient record and optionally books an appointment.
 *       Requires clinic_id to be set on the request before approval.
 *       Uses SELECT FOR UPDATE to prevent concurrent approvals.
 *       If auto-booking fails (slot taken), patient is still created — warning returned.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               preferredSlotId: { type: string, format: uuid }
 *               autoBook: { type: boolean }
 *     responses:
 *       200:
 *         description: Approved — patient created, booking attempted if requested
 *       400:
 *         description: Already processed or clinic not assigned
 *       409:
 *         description: Patient with this phone already exists in the clinic
 */
router.post(
  "/:id/approve",
  authenticate,
  authorize("patients:create"),
  validate({
    params: requestIdParamSchema,
    body: (t) => createPatientRequestSchemas(t).approve,
  }),
  patientRequestController.approve
);

/**
 * @openapi
 * /patient-requests/{id}/reject:
 *   post:
 *     tags: [PatientRequests]
 *     summary: Reject a patient request
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
  authorize("patients:create"),
  validate({
    params: requestIdParamSchema,
    body: (t) => createPatientRequestSchemas(t).reject,
  }),
  patientRequestController.reject
);

export default router;
