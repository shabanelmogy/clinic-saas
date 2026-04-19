import { Router } from "express";
import { appointmentController } from "./appointment.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorize, authorizeAny } from "../rbac/authorize.middleware.js";
import { idParamSchema } from "../../utils/shared-validators.js";
import { createAppointmentSchemas, cancelAppointmentSchema } from "./appointment.validation.js";

const router = Router();

/**
 * @openapi
 * /appointments:
 *   get:
 *     tags: [Appointments]
 *     summary: List all appointments
 *     description: Returns a paginated list of appointments. Supports filtering by userId, status, and date range.
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: userId
 *         in: query
 *         description: Filter by user UUID
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: status
 *         in: query
 *         schema:
 *           $ref: '#/components/schemas/AppointmentStatus'
 *       - name: from
 *         in: query
 *         description: Start of date range (ISO 8601)
 *         schema:
 *           type: string
 *           format: date-time
 *         example: "2026-01-01T00:00:00Z"
 *       - name: to
 *         in: query
 *         description: End of date range (ISO 8601)
 *         schema:
 *           type: string
 *           format: date-time
 *         example: "2026-12-31T23:59:59Z"
 *     responses:
 *       200:
 *         description: Paginated list of appointments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Appointments retrieved }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Appointment'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 */
router.get(
  "/",
  authenticate,
  authorizeAny(["appointments:view_all", "appointments:view_own"]),
  validate({ query: (t) => createAppointmentSchemas(t).listQuery }),
  appointmentController.list
);

/**
 * @openapi
 * /appointments/{id}:
 *   get:
 *     tags: [Appointments]
 *     summary: Get an appointment by ID
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Appointment found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Appointment retrieved }
 *                 data:
 *                   $ref: '#/components/schemas/Appointment'
 *       404:
 *         description: Appointment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       422:
 *         description: Invalid UUID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 */
router.get(
  "/:id",
  authenticate,
  validate({ params: idParamSchema }),
  appointmentController.getById
);

/**
 * @openapi
 * /appointments:
 *   post:
 *     tags: [Appointments]
 *     summary: Create a new appointment
 *     description: |
 *       If `slotId` is provided, books the slot atomically (SELECT FOR UPDATE).
 *       `scheduledAt` is derived from the slot's start time.
 *       Without `slotId`, creates a walk-in appointment with the provided `scheduledAt`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, scheduledAt]
 *             properties:
 *               patientId: { type: string, format: uuid, description: "Required for staff bookings" }
 *               clinicId: { type: string, format: uuid, description: "Required for patient bookings" }
 *               slotId: { type: string, format: uuid, description: "Optional — links to a slot" }
 *               title: { type: string, minLength: 2, maxLength: 200, example: "Initial Consultation" }
 *               description: { type: string }
 *               scheduledAt: { type: string, format: date-time, example: "2026-06-15T10:00:00Z" }
 *               durationMinutes: { type: integer, minimum: 5, maximum: 480, default: 60 }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Appointment created
 *       400:
 *         description: Patient is inactive or missing required fields
 *       404:
 *         description: Patient not found
 *       409:
 *         description: Slot no longer available
 *       422:
 *         description: Validation error
 */
router.post(
  "/",
  authenticate,
  authorize("appointments:create"),
  validate({ body: (t) => createAppointmentSchemas(t).create }),
  appointmentController.create
);

/**
 * @openapi
 * /appointments/{id}:
 *   patch:
 *     tags: [Appointments]
 *     summary: Update an appointment
 *     description: Cannot update appointments with status `cancelled` or `completed`.
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
 *               title: { type: string, minLength: 2, maxLength: 200 }
 *               description: { type: string }
 *               scheduledAt: { type: string, format: date-time }
 *               durationMinutes: { type: integer, minimum: 5, maximum: 480 }
 *               status: { type: string, enum: [pending, confirmed, cancelled, completed, no_show] }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Appointment updated
 *       400:
 *         description: Cannot update a cancelled or completed appointment
 *       404:
 *         description: Appointment not found
 *       422:
 *         description: Validation error
 */
router.patch(
  "/:id",
  authenticate,
  authorize("appointments:update"),
  validate({ 
    params: idParamSchema, 
    body: (t) => createAppointmentSchemas(t).update 
  }),
  appointmentController.update
);

/**
 * @openapi
 * /appointments/{id}:
 *   delete:
 *     tags: [Appointments]
 *     summary: Delete an appointment
 *     description: Cannot delete a `confirmed` appointment — cancel it first.
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Appointment deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Appointment deleted successfully }
 *                 data: { nullable: true, example: null }
 *       400:
 *         description: Cannot delete a confirmed appointment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       404:
 *         description: Appointment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       422:
 *         description: Invalid UUID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 */
router.delete(
  "/:id",
  authenticate,
  authorize("appointments:delete"),
  validate({ params: idParamSchema }),
  appointmentController.remove
);

/**
 * @openapi
 * /appointments/{id}/cancel:
 *   post:
 *     tags: [Appointments]
 *     summary: Cancel an appointment
 *     description: |
 *       Transactionally cancels the appointment and releases the linked slot (if any).
 *       Uses optimistic locking — returns 409 if a concurrent update is detected.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Appointment cancelled and slot released
 *       400:
 *         description: Appointment is already in a terminal status
 *       409:
 *         description: Concurrent update detected — retry
 *       404:
 *         description: Appointment not found
 */
router.post(
  "/:id/cancel",
  authenticate,
  authorizeAny(["appointments:update", "appointments:view_own"]),
  validate({ params: idParamSchema, body: (t) => cancelAppointmentSchema(t) }),
  appointmentController.cancel
);

export default router;
